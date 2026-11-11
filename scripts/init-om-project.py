"""Create a new OM project from this repository's desktop skills."""

import argparse
from pathlib import Path
from shutil import copy2, copytree, ignore_patterns


def main():
    parser = argparse.ArgumentParser(description="Initialize a new Operating Model project")
    parser.add_argument("directory", type=Path, help="A new or empty project directory")
    target = parser.parse_args().directory.expanduser()
    repository = Path(__file__).resolve().parents[1]
    template = repository / "templates" / "om-project"
    skills = repository / ".agents" / "skills"
    skill_names = ["operating-model-work", "operating-model-design"]
    if (skills / "chatgpt-om-work" / "SKILL.md").is_file():
        skill_names.append("chatgpt-om-work")

    for name in skill_names:
        if not (skills / name / "SKILL.md").is_file():
            parser.error(f"Missing skill: {skills / name}")
    if target.is_symlink() or (target.exists() and (not target.is_dir() or any(target.iterdir()))):
        parser.error(f"Choose a new or empty directory: {target}")

    target.mkdir(parents=True, exist_ok=True)
    target_skills = target / ".agents" / "skills"
    target_skills.mkdir(parents=True)
    for name in skill_names:
        copytree(skills / name, target_skills / name, ignore=ignore_patterns(".DS_Store", "__pycache__"))
    for name in ("AGENTS.md", "om.md", ".gitignore"):
        copy2(template / name, target / name)
    (target / "CLAUDE.md").write_text("@AGENTS.md\n", encoding="utf-8")
    print(f"Initialized OM project: {target.resolve()}")


if __name__ == "__main__":
    main()
