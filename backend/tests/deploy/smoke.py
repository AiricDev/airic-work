"""Exercise the built image with a disposable Compose project and no model calls."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
from urllib.error import HTTPError
from urllib.request import Request, urlopen

TEST_DIR = Path(__file__).resolve().parent
COMPOSE_FILE = TEST_DIR.parents[2] / "deploy" / "compose.yaml"


def main():
    token = secrets.token_hex(32)
    project = "airic-smoke-" + secrets.token_hex(6)
    with tempfile.TemporaryDirectory() as directory:
        deployment = Path(directory).resolve()
        compose_file = deployment / COMPOSE_FILE.name
        compose_file.write_bytes(COMPOSE_FILE.read_bytes())
        override = deployment / "smoke.compose.yaml"
        override.write_text(
            'services:\n  airic-work:\n    ports: !override ["127.0.0.1::8080"]\n'
        )
        env_file = deployment / ".env"
        env_file.write_text(
            f"AIRIC_SECRET_KEY={token}\nAIRIC_TASK_WORKER=0\n"
            f"AIRIC_OM_REPOSITORY={deployment / 'om'}\n"
        )
        env_file.chmod(0o600)
        data = deployment / "data"
        data.mkdir(mode=0o700)
        repo = deployment / "om"
        repo.mkdir()
        (repo / "om.md").write_text("Smoke test operating model.")
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        subprocess.run(["git", "-C", str(repo), "add", "om.md"], check=True)
        subprocess.run(["git", "-C", str(repo), "-c", "user.name=Smoke", "-c", "user.email=smoke@example.invalid", "commit", "-qm", "Add OM"], check=True)

        env = {
            **os.environ,
            "AIRIC_IMAGE": os.environ.get("AIRIC_IMAGE", "airic-work:task"),
            "AIRIC_OM_REPOSITORY": str(repo),
            "AIRIC_DEPLOY_DATA": str(data),
            "AIRIC_DEPLOY_UID": str(os.getuid()),
            "AIRIC_DEPLOY_GID": str(os.getgid()),
        }
        if sys.platform.startswith("linux") and "AIRIC_DOCKER_SOCKET_GID" not in env:
            env["AIRIC_DOCKER_SOCKET_GID"] = str(Path("/var/run/docker.sock").stat().st_gid)

        def compose(*args, stdin=None):
            return subprocess.check_output(
                ["docker", "compose", "-f", str(compose_file), "-f", str(override), "-p", project, *args],
                env=env, text=True, input=stdin,
            ).strip()

        def request(path, *, method="GET", payload=None, extra=None, auth=True):
            address = compose("port", "airic-work", "8080").splitlines()[0]
            headers = {"Authorization": f"Bearer {token}"} if auth else {}
            if extra:
                headers.update(extra)
            req = Request("http://" + address + path, data=payload, method=method, headers=headers)
            try:
                with urlopen(req, timeout=5) as response:
                    return response.status, response.read()
            except HTTPError as error:
                return error.code, error.read()

        try:
            compose("up", "-d", "--wait", "--wait-timeout", "60", "--no-build")
            assert request("/healthz", auth=False)[0] == 200
            assert b"swagger-ui-bundle.js" in request("/docs/", auth=False)[1]
            assert request("/docs/swagger-ui-bundle.js", auth=False)[0] == 200
            assert b"operationId: createTask" in request("/openapi.yaml", auth=False)[1]
            assert request("/api/v1/tasks", auth=False)[0] == 401
            evidence = b"isolated container evidence"
            multipart = (
                b'--smoke\r\nContent-Disposition: form-data; name="file"; filename="evidence.txt"\r\n'
                b'Content-Type: text/plain\r\n\r\n' + evidence + b'\r\n--smoke--\r\n'
            )
            upload_status, upload_bytes = request(
                "/api/v1/uploads", method="POST", payload=multipart,
                extra={"Content-Type": "multipart/form-data; boundary=smoke", "Idempotency-Key": "upload"},
            )
            assert upload_status == 201
            upload = json.loads(upload_bytes)
            assert upload["sha256"] == hashlib.sha256(evidence).hexdigest()
            creation = json.dumps({
                "instruction": "Check the evidence",
                "materials": [{"kind": "upload", "uploadId": upload["uploadId"]}],
            }).encode()
            headers = {"Content-Type": "application/json", "Idempotency-Key": "create"}
            status, payload = request("/api/v1/tasks", method="POST", payload=creation, extra=headers)
            assert status == 201
            task_url = "/api/v1/tasks/" + json.loads(payload)["taskId"]
            compose("up", "-d", "--force-recreate", "--wait", "--wait-timeout", "60", "--no-build")
            assert request("/api/v1/tasks", method="POST", payload=creation, extra=headers) == (201, payload)
            assert request(task_url + "/files/" + upload["uploadId"]) == (200, evidence)
            print(compose(
                "exec", "-T", "-w", "/app/backend", "airic-work",
                "node", "--import", "tsx", "--input-type=module", "-",
                stdin=(TEST_DIR / "workspace-smoke.mjs").read_text(),
            ))
            print("Compose smoke passed: Swagger, authentication, uploads and Task persistence")
        finally:
            compose("down")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--certlab", type=Path, help="Run the dual-service smoke against a CertLab checkout")
    options = parser.parse_args()
    if options.certlab:
        subprocess.run([sys.executable, TEST_DIR / "certlab_smoke.py", options.certlab], check=True)
    else:
        main()
