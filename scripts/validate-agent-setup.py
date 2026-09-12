#!/usr/bin/env python3
"""Read-only static validation for the canonical Codex agent setup."""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from pathlib import Path


STANDING = {
    "customer-comms.toml": ("customer_comms", "gpt-5.6-luna", "medium"),
    "default.toml": ("default", "gpt-5.6-sol", "low"),
    "explorer.toml": ("explorer", "gpt-5.6-luna", "medium"),
    "iac-planner.toml": ("iac_planner", "gpt-6-astra", "high"),
    "infra-planner.toml": ("infra_planner", "gpt-6-astra", "high"),
    "infra-recon.toml": ("infra_recon", "gpt-6-astra", "low"),
    "msp-triage.toml": ("msp_triage", "gpt-6-astra", "medium"),
    "project-architect.toml": ("project_architect", "gpt-6-astra", "high"),
    "project-builder.toml": ("project_builder", "gpt-5.6-sol", "medium"),
    "project-reviewer.toml": ("project_reviewer", "gpt-5.6-sol", "high"),
    "risk-reviewer.toml": ("risk_reviewer", "gpt-6-astra", "high"),
    "test-mapper.toml": ("test_mapper", "gpt-5.6-luna", "medium"),
    "test-strategist.toml": ("test_strategist", "gpt-6-astra", "high"),
    "web-builder.toml": ("web_builder", "gpt-5.6-sol", "medium"),
    "web-scout.toml": ("web_scout", "gpt-5.6-sol", "medium"),
    "worker.toml": ("worker", "gpt-5.6-sol", "low"),
}
VARIANTS = {
    "project-builder-high.toml": ("project_builder_high", "gpt-5.6-sol", "high"),
    "project-reviewer-astra-high.toml": ("project_reviewer_astra_high", "gpt-6-astra", "high"),
    "web-builder-high.toml": ("web_builder_high", "gpt-5.6-sol", "high"),
    "web-scout-high.toml": ("web_scout_high", "gpt-5.6-sol", "high"),
}
ROLES = {**STANDING, **VARIANTS}
SKILLS = {
    "local-goal-loop": set(),
    "web-project-delivery": {"web_builder", "web_builder_high"},
    "linux-server-maintenance": {"infra_recon", "infra_planner"},
    "infrastructure-as-code-ops": {"iac_planner"},
    "msp-ticket-ops": {"msp_triage"},
}
IGNORED_ROLE_KEYS = {"sandbox_mode", "agents", "mcp_servers", "plugins"}
WEB_BUILDERS = {"web_builder", "web_builder_high"}
NO_PROMPT_PATTERNS = (
    r"approval gate",
    r"manual approval",
    r"explicit human approval",
    r"stop for approval",
    r"wait for explicit user approval",
    r"approval-gated",
    r"requires explicit confirmation",
    r"ask before",
    r"ask the user",
)


class Validator:
    def __init__(self) -> None:
        self.issues: list[dict[str, str]] = []

    def issue(self, code: str, path: Path) -> None:
        self.issues.append({"code": code, "path": str(path)})

    def load(self, path: Path) -> dict | None:
        try:
            with path.open("rb") as stream:
                return tomllib.load(stream)
        except (OSError, tomllib.TOMLDecodeError):
            self.issue("missing_or_invalid_toml", path)
            return None

    def require(self, condition: bool, code: str, path: Path) -> None:
        if not condition:
            self.issue(code, path)

    def validate_config(self, home: Path, installed: bool) -> None:
        path = home / "config.toml"
        config = self.load(path)
        if config is None:
            return
        self.require(config.get("model") == "gpt-6-astra", "wrong_root_model", path)
        self.require(config.get("model_reasoning_effort") == "low", "wrong_root_effort", path)
        self.require(config.get("sandbox_mode") == "danger-full-access", "wrong_root_sandbox", path)
        self.require(config.get("approval_policy") == "never", "wrong_approval_policy", path)
        agents = config.get("agents", {})
        self.require(agents.get("enabled") is True, "agents_not_enabled", path)
        self.require(agents.get("max_concurrent_threads_per_session") == 2, "wrong_child_ceiling", path)
        self.require(agents.get("default_subagent_model") == "gpt-5.6-sol", "wrong_fallback_model", path)
        self.require(agents.get("default_subagent_reasoning_effort") == "low", "wrong_fallback_effort", path)
        app_defaults = config.get("apps", {}).get("_default", {})
        self.require(app_defaults.get("default_tools_approval_mode") == "approve", "wrong_app_approval_mode", path)
        self.require(app_defaults.get("destructive_enabled") is True, "app_destructive_tools_not_enabled", path)
        self.require(app_defaults.get("open_world_enabled") is True, "app_open_world_not_enabled", path)
        if installed:
            for server_name, server in config.get("mcp_servers", {}).items():
                self.require(
                    server.get("default_tools_approval_mode") == "approve",
                    f"wrong_mcp_approval_mode_{server_name}",
                    path,
                )

    def validate_profiles(self, home: Path) -> None:
        for effort in ("low", "medium", "high"):
            path = home / f"root-{effort}.config.toml"
            profile = self.load(path)
            if profile is None:
                continue
            self.require(profile.get("model") == "gpt-6-astra", "wrong_profile_model", path)
            self.require(profile.get("model_reasoning_effort") == effort, "wrong_profile_effort", path)
            self.require("sandbox_mode" not in profile, "profile_overrides_sandbox", path)
            self.require("approval_policy" not in profile, "profile_overrides_approval", path)

    def validate_browser(self, home: Path) -> None:
        path = home / "browser" / "config.toml"
        config = self.load(path)
        if config is None:
            return
        for key in (
            "approval_mode",
            "history_approval_mode",
            "iab_history_approval_mode",
            "download_approval_mode",
            "upload_approval_mode",
        ):
            self.require(config.get(key) == "never_ask", f"wrong_browser_{key}", path)
        self.require(config.get("disable_auto_review") is True, "browser_auto_review_enabled", path)
        self.require(config.get("full_cdp_access_enabled") is True, "browser_full_cdp_disabled", path)
        self.require(config.get("webmcp_enabled") is True, "browser_webmcp_disabled", path)
        for section in ("origins", "downloads", "uploads", "full_cdp"):
            self.require(config.get(section, {}).get("allowed") == ["*"], f"browser_{section}_not_global", path)

    def validate_agents(self, home: Path) -> None:
        root = home / "agents"
        try:
            files = sorted(path for path in root.iterdir() if path.is_file() and path.suffix == ".toml")
        except OSError:
            self.issue("missing_agents_directory", root)
            return
        actual = {path.name for path in files}
        for filename in sorted(set(ROLES) - actual):
            self.issue("missing_agent", root / filename)
        for filename in sorted(actual - set(ROLES)):
            self.issue("unexpected_agent", root / filename)
        names: dict[str, Path] = {}
        resolved: dict[Path, Path] = {}
        for path in files:
            target = path.resolve()
            if target in resolved:
                self.issue("duplicate_resolved_agent", path)
            else:
                resolved[target] = path
            if path.name not in ROLES:
                continue
            role = self.load(path)
            if role is None:
                continue
            expected_name, expected_model, expected_effort = ROLES[path.name]
            name = role.get("name")
            self.require(name == expected_name, "wrong_agent_name", path)
            if isinstance(name, str):
                if name in names:
                    self.issue("duplicate_agent_name", path)
                else:
                    names[name] = path
            self.require(role.get("model") == expected_model, "wrong_agent_model", path)
            self.require(role.get("model_reasoning_effort") == expected_effort, "wrong_agent_effort", path)
            self.require(bool(role.get("description")), "missing_agent_description", path)
            self.require(bool(role.get("developer_instructions")), "missing_agent_instructions", path)
            instructions = role.get("developer_instructions", "")
            self.require("FULL_ACCESS_BY_DESIGN" in instructions, "missing_full_access_contract", path)
            self.require("return questions" in instructions.lower(), "missing_root_question_route", path)
            for key in sorted(IGNORED_ROLE_KEYS):
                self.require(key not in role, f"unsupported_role_key_{key}", path)
            features = role.get("features", {})
            self.require(isinstance(features, dict), "invalid_role_features", path)
            if isinstance(features, dict):
                self.require(features.get("apps") is False, "wrong_feature_state_apps", path)
                self.require(features.get("request_permissions_tool") is False, "wrong_feature_state_request_permissions_tool", path)
                if expected_name in WEB_BUILDERS:
                    self.require("plugins" not in features, "web_builder_must_inherit_plugins", path)
                else:
                    self.require(features.get("plugins") is False, "wrong_feature_state_plugins", path)
            skill_rows = role.get("skills", {}).get("config", [])
            states: dict[str, bool | None] = {}
            for row in skill_rows if isinstance(skill_rows, list) else []:
                skill_path = row.get("path")
                if not isinstance(skill_path, str):
                    self.issue("invalid_skill_path", path)
                    continue
                skill_name = Path(skill_path).parent.name
                if skill_name in states:
                    self.issue("duplicate_skill_entry", path)
                enabled = row.get("enabled")
                self.require(isinstance(enabled, bool), "invalid_skill_state", path)
                states[skill_name] = enabled if isinstance(enabled, bool) else None
            self.require(set(states) == set(SKILLS), "wrong_skill_inventory", path)
            for skill_name, enabled_roles in SKILLS.items():
                self.require(states.get(skill_name) is (expected_name in enabled_roles), f"wrong_skill_state_{skill_name}", path)

    def validate_project_shadows(self, projects_root: Path) -> None:
        try:
            roots = [path for path in projects_root.iterdir() if path.is_dir() and not path.name.startswith(".")]
        except OSError:
            self.issue("missing_projects_root", projects_root)
            return
        portfolio = projects_root / "portfolio"
        if portfolio.is_dir():
            roots.extend(
                path for path in portfolio.iterdir()
                if path.is_dir() and not path.name.startswith(".") and ((path / "AGENTS.md").exists() or (path / ".git").exists())
            )
        for root in sorted(set(roots)):
            agents = root / ".codex" / "agents"
            if agents.is_dir():
                for path in sorted(agents.glob("*.toml")):
                    self.issue("project_agent_shadow", path)

    def validate_project_policies(self, targets_file: Path) -> None:
        try:
            rows = targets_file.read_text(encoding="utf-8").splitlines()
        except OSError:
            self.issue("missing_project_targets_file", targets_file)
            return
        seen: set[Path] = set()
        for row in rows:
            value = row.strip()
            if not value or value.startswith("#"):
                continue
            path = Path(value).resolve()
            if path in seen:
                self.issue("duplicate_project_policy_target", path)
                continue
            seen.add(path)
            try:
                policy = path.read_text(encoding="utf-8")
            except OSError:
                self.issue("missing_project_policy", path)
                continue
            self.require("FULL_ACCESS_BY_DESIGN" in policy, "missing_project_full_access_policy", path)
            for pattern in NO_PROMPT_PATTERNS:
                self.require(re.search(pattern, policy, re.IGNORECASE) is None, "interactive_project_gate_present", path)

    def validate_policy_contract(self, home: Path, installed: bool) -> None:
        agents_path = home / "AGENTS.md"
        try:
            agents = agents_path.read_text(encoding="utf-8")
        except OSError:
            self.issue("missing_agents_policy", agents_path)
            return
        self.require("FULL_ACCESS_BY_DESIGN" in agents, "missing_full_access_policy", agents_path)
        self.require("Do not ask again for routine confirmation or permission" in agents, "missing_no_repeat_prompt_policy", agents_path)
        rules_path = home / "rules" / ("agent-team.rules" if installed else "default.rules")
        try:
            rules = rules_path.read_text(encoding="utf-8")
        except OSError:
            self.issue("missing_rules_policy", rules_path)
            return
        self.require('decision = "prompt"' not in rules, "prompt_rule_present", rules_path)
        self.require('decision = "forbidden"' not in rules, "forbidden_rule_present", rules_path)
        self.require('decision = "allow"' in rules, "missing_shell_allow_rule", rules_path)
        self.require('"/bin/bash"' in rules, "missing_bash_allow_rule", rules_path)
        self.require('"rm"' in rules, "missing_recursive_delete_allow_rule", rules_path)
        self.require('"scp"' in rules, "missing_remote_copy_allow_rule", rules_path)

    def validate_launcher(self, path: Path, require_executable: bool = True) -> None:
        try:
            launcher = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            self.issue("missing_or_non_text_codex_launcher", path)
            return
        self.require(path.is_file() and not path.is_symlink(), "launcher_not_regular_file", path)
        if require_executable:
            self.require(path.stat().st_mode & 0o111 != 0, "launcher_not_executable", path)
        self.require(
            "--dangerously-bypass-approvals-and-sandbox" in launcher,
            "launcher_missing_full_bypass",
            path,
        )
        self.require("exec \"$codex_real_bin\"" in launcher, "launcher_missing_exec", path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--templates-root", type=Path, default=Path(__file__).resolve().parent.parent / "templates")
    parser.add_argument("--codex-home", type=Path)
    parser.add_argument("--projects-root", type=Path)
    parser.add_argument("--project-targets-file", type=Path)
    parser.add_argument("--codex-launcher", type=Path)
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    validator = Validator()
    template_home = args.templates_root.resolve() / "home-codex"
    validator.validate_config(template_home, installed=False)
    validator.validate_profiles(template_home)
    validator.validate_browser(template_home)
    validator.validate_launcher(template_home / "bin" / "codex", require_executable=False)
    validator.validate_agents(template_home)
    validator.validate_policy_contract(template_home, installed=False)
    if args.codex_home is not None:
        installed_home = args.codex_home.resolve()
        validator.validate_config(installed_home, installed=True)
        validator.validate_profiles(installed_home)
        validator.validate_browser(installed_home)
        validator.validate_agents(installed_home)
        validator.validate_policy_contract(installed_home, installed=True)
    if args.projects_root is not None:
        validator.validate_project_shadows(args.projects_root.resolve())
    if args.project_targets_file is not None:
        validator.validate_project_policies(args.project_targets_file.resolve())
    if args.codex_launcher is not None:
        validator.validate_launcher(args.codex_launcher.absolute())
    result = {
        "ok": not validator.issues,
        "issue_count": len(validator.issues),
        "issues": validator.issues,
        "configuration_fields_checked": [
            "model",
            "model_reasoning_effort",
            "selected_features",
            "skills_config_declarations",
            "browser_no_prompt_configuration",
            "full_bypass_launcher",
        ],
        "instruction_only_role_controls": [
            "scope_and_write_ownership",
            "no_child_recursion",
            "questions_route_to_root",
        ],
    }
    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print("PASS" if result["ok"] else "FAIL")
        for issue in validator.issues:
            print(f"{issue['code']}: {issue['path']}")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
