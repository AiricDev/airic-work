"""Run both checkouts with isolated data and a deterministic model."""

import json
import os
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from contextlib import ExitStack
from pathlib import Path

TEST_DIR = Path(__file__).resolve().parent
BACKEND = TEST_DIR.parents[1]


def seed():
    import django

    django.setup()
    from certlab.container import get_container
    from django.contrib.auth import get_user_model
    from django.core.management import call_command
    from tests.conftest import add_user_to_role
    from tests.factories import assessment_by_code, build_scene

    def make_user(name, role):
        user = get_user_model().objects.create_user(
            username=name, password="fixture-only"
        )
        add_user_to_role(user, role)
        return user

    call_command("migrate", verbosity=0)
    scene = build_scene(make_user)
    tokens = get_container().tokens
    Path(os.environ["AIRIC_CERTLAB_SMOKE_DIR"], "fixture.json").write_text(
        json.dumps(
            {
                "project": scene.project_id,
                "report": scene.report_id,
                "assessment": str(assessment_by_code(scene.report_id, "1.1").id),
                "engineer": tokens.issue(user_id=str(scene.engineer.pk)).raw,
                "reviewer": tokens.issue(user_id=str(scene.reviewer.pk)).raw,
                "reviewer_id": str(scene.reviewer.pk),
            }
        )
    )


def check():
    import httpx

    data = Path(os.environ["AIRIC_CERTLAB_SMOKE_DIR"])
    fixture = json.loads((data / "fixture.json").read_text())
    client = httpx.Client(
        base_url=os.environ["CERTLAB_PUBLIC_ORIGIN"],
        verify=str(data / "cert.pem"),
        trust_env=False,
    )
    engineer = {"Authorization": f"Bearer {fixture['engineer']}"}
    reviewer = {"Authorization": f"Bearer {fixture['reviewer']}"}
    project = f"/api/v1/projects/{fixture['project']}"

    def poll(read, predicate):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            try:
                response = read()
                if response.is_success and predicate(response.json()):
                    return response.json()
            except httpx.TransportError:
                pass
            time.sleep(0.25)
        raise RuntimeError("Timed out waiting for service state")

    poll(
        lambda: client.get(f"{project}/agent-tasks/om-status", headers=engineer),
        lambda item: item["state"] == "available",
    )
    report_path = f"/api/v1/reports/{fixture['report']}"
    report = client.get(report_path, headers=engineer)
    report.raise_for_status()
    created = client.post(
        f"{report_path}/agent-tasks",
        headers={**engineer, "Idempotency-Key": "field-assessment"},
        json={
            "instruction": "Arrange fieldwork",
            "report_version": report.json()["version"],
        },
    )
    assert created.status_code == 201, created.text
    report_task = f"{project}/agent-tasks/{created.json()['taskId']}"
    waiting = poll(
        lambda: client.get(report_task, headers=engineer),
        lambda item: item["phase"] == "waiting",
    )
    [question] = waiting["questions"]
    session = poll(
        lambda: client.get(f"{report_task}/session", headers=engineer),
        lambda item: bool(item["sessionId"]),
    )
    request = f"{project}/decision-requests/{question['id']}"
    answer = client.post(
        f"{request}/user-decisions",
        headers={**reviewer, "Idempotency-Key": "answer"},
        json={"contextRevision": 1, "text": "Proceed with fieldwork"},
    )
    assert answer.status_code == 201, answer.text
    assert answer.json()["actorId"] == fixture["reviewer_id"]
    resumed = poll(
        lambda: client.get(f"{report_task}/session", headers=engineer),
        lambda item: any(event["kind"] == "continuation" for event in item["items"]),
    )
    assert resumed["sessionId"] == session["sessionId"]
    items = poll(
        lambda: client.get(f"{report_task}/results", headers=engineer),
        lambda value: any(item["kind"] == "test-task" for item in value["items"]),
    )
    field = next(item for item in items["items"] if item["kind"] == "test-task")
    field_path = f"/api/v1/test-tasks/{field['id']}"
    details = client.get(field_path, headers=engineer).json()
    completed = client.post(
        f"{field_path}/complete",
        headers={**engineer, "Idempotency-Key": "complete-fieldwork"},
        json={
            "expected_version": details["version"],
            "mode": "no_longer_needed",
            "source": "Fixture engineer",
            "note": "Existing measurement supplied",
            "expected_assessments": [],
        },
    )
    assert completed.status_code == 200, completed.text
    root = Path(os.environ["CERTLAB_FIXTURE_ROOT"])
    subprocess.run(
        [sys.executable, str(root / "manage.py"), "run_worker", "--once"],
        cwd=root,
        check=True,
    )

    def has_completion(value):
        return any(
            item["kind"] == "steering" and item["delivery"]["state"] == "delivered"
            for item in value["items"]
        )

    poll(lambda: client.get(f"{report_task}/inputs", headers=engineer), has_completion)
    poll(
        lambda: client.get(f"{report_task}/session", headers=engineer),
        lambda value: any(
            item.get("text") == "Verified the completed CertLab field work"
            for item in value["items"]
        ),
    )
    print(
        "Dual-service smoke passed: Task creation, reviewer answer in the original Session, MCP fieldwork and completion notification."
    )


def run(certlab):
    certlab = certlab.resolve()
    python = certlab / ".venv" / "bin" / "python"
    if not python.is_file():
        raise SystemExit(
            f"Install CertLab's development dependencies in {certlab} with uv sync --extra dev"
        )

    with tempfile.TemporaryDirectory(prefix="airic-certlab-smoke-") as directory:
        root = Path(directory)
        data = root / "tasks"
        data.mkdir()
        repo = root / "om"
        repo.mkdir()
        (repo / "om.md").write_text("Fixture OM for project intake")
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        subprocess.run(["git", "-C", str(repo), "add", "om.md"], check=True)
        subprocess.run(
            [
                "git",
                "-C",
                str(repo),
                "-c",
                "user.name=Smoke",
                "-c",
                "user.email=smoke@example.invalid",
                "commit",
                "-qm",
                "Add OM",
            ],
            check=True,
        )
        subprocess.run(
            [
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-days",
                "1",
                "-subj",
                "/CN=127.0.0.1",
                "-addext",
                "subjectAltName=IP:127.0.0.1",
                "-keyout",
                "cert.key",
                "-out",
                "cert.pem",
            ],
            cwd=root,
            check=True,
            capture_output=True,
        )
        # Reserve two different loopback ports until we are ready to start the servers.
        with socket.socket() as certlab_socket, socket.socket() as airic_socket:
            certlab_socket.bind(("127.0.0.1", 0))
            airic_socket.bind(("127.0.0.1", 0))
            certlab_port = str(certlab_socket.getsockname()[1])
            airic_port = str(airic_socket.getsockname()[1])
        origin = f"https://127.0.0.1:{certlab_port}"
        shared = {
            "AIRIC_SECRET_KEY": secrets.token_hex(32),
            "AIRIC_CERTLAB_SMOKE_DIR": directory,
        }
        # Run with test settings and an explicit environment, independent of either checkout's .env.
        system = {
            key: os.environ[key]
            for key in ("PATH", "SYSTEMROOT", "TMPDIR")
            if key in os.environ
        }
        certlab_env = {
            **system,
            **shared,
            "DJANGO_SETTINGS_MODULE": "certlab.infrastructure.settings",
            "DJANGO_SECRET_KEY": secrets.token_hex(32),
            "DJANGO_ALLOWED_HOSTS": "127.0.0.1",
            "CERTLAB_FIXTURE_ROOT": str(certlab),
            "CERTLAB_DATA_DIR": str(root / "certlab"),
            "CERTLAB_PUBLIC_ORIGIN": origin,
            "CERTLAB_AIRIC_URL": f"http://127.0.0.1:{airic_port}",
            "PYTHONPATH": str(certlab),
        }
        airic_env = {
            **system,
            **shared,
            "AIRIC_TASK_DATA": str(data),
            "AIRIC_TASK_PORT": airic_port,
            "AIRIC_TASK_WORKER": "1",
            "AIRIC_OM_REPOSITORY": str(repo),
            "AIRIC_TASK_MCP_ALLOWLIST": json.dumps([origin + "/mcp"]),
            "AIRIC_MODEL_PROVIDER": "faux",
            "AIRIC_MODEL_ID": "faux-1",
            "AIRIC_MODEL_API_KEY": "fixture-only",
            "NODE_EXTRA_CA_CERTS": str(root / "cert.pem"),
        }
        script = Path(__file__).resolve()
        subprocess.run(
            [python, script, "seed"], cwd=root, env=certlab_env, check=True, timeout=60
        )
        commands = [
            (
                "certlab",
                [
                    python,
                    "-m",
                    "uvicorn",
                    "certlab.infrastructure.asgi:application",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    certlab_port,
                    "--ssl-keyfile",
                    root / "cert.key",
                    "--ssl-certfile",
                    root / "cert.pem",
                ],
                root,
                certlab_env,
            ),
            (
                "airic-work",
                [
                    "node",
                    "--import",
                    "tsx",
                    "--import",
                    TEST_DIR / "certlab-model.mjs",
                    "src/bootstrap/task-http.ts",
                ],
                BACKEND,
                airic_env,
            ),
        ]
        with ExitStack() as resources:
            logs = []
            for name, command, cwd, env in commands:
                path = root / f"{name}.log"
                output = resources.enter_context(path.open("w"))
                logs.append(path)
                process = subprocess.Popen(
                    command, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT
                )
                resources.callback(stop, process)
            try:
                subprocess.run(
                    [python, script, "check"],
                    cwd=root,
                    env=certlab_env,
                    check=True,
                    timeout=90,
                )
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                for log in logs:
                    print(
                        f"{log.stem} log:\n"
                        + "\n".join(log.read_text().splitlines()[-25:]),
                        file=sys.stderr,
                    )
                raise


def stop(process):
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


if __name__ == "__main__":
    if sys.argv[1:] == ["seed"]:
        seed()
    elif sys.argv[1:] == ["check"]:
        check()
    else:
        run(Path(sys.argv[1]))
