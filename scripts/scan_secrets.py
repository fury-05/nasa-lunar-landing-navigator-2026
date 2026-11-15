#!/usr/bin/env python3
"""Scan files tracked by git for secrets and infrastructure details (P7-03).

Not a replacement for gitleaks: a small, dependency-free check that runs offline. It never prints
the matched secret text, only file, line number, rule name and a masked length.

Rules:
  private-key      PEM private key header
  aws-access-key   AKIA/ASIA style access key id
  aws-secret       40 character secret next to an aws secret key name
  token            GitHub, Slack, Google API, generic bearer or "token = <long value>" assignments
  pem-path         a path ending in .pem
  ip-address       IPv4 address that is not loopback, private, documentation or a version-like string
  secret-assign    NAME=value for names such as PASSWORD, SECRET, TOKEN, API_KEY with a long value
  db-url-password  scheme://user:password@host URL with a non-placeholder password

The public project host (13-52-97-105.sslip.io and its Elastic IP) is intentional and listed in
ALLOW_HOSTS. Anything else is reported. Exit code 1 when any finding is not allowlisted.

Usage: python scripts/scan_secrets.py [--list-allowed]
"""
from __future__ import annotations

import ipaddress
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Intentional public values (see docs/validation/security-dependency-audit.md).
ALLOW_HOSTS = {"13.52.97.105", "13-52-97-105.sslip.io"}
# Files that document patterns or hold fixtures and are expected to contain look-alike text.
SKIP_FILES = {"scripts/scan_secrets.py", "package-lock.json", "uv.lock"}
SKIP_SUFFIX = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".tif", ".tiff", ".zip"}
PLACEHOLDER = re.compile(r"^\$|change[-_ ]?me|example|placeholder|<[^>]+>|\$\{|xxx|\*\*\*|password|secret|^$", re.I)  # a leading $ is a shell variable, not a literal secret

RULES = [
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY")),
    ("aws-access-key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("aws-secret", re.compile(r"aws_?secret_?access_?key\W{0,6}[A-Za-z0-9/+=]{40}\b", re.I)),
    ("token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b"
                         r"|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|\bAIza[0-9A-Za-z_-]{35}\b"
                         r"|\bsk-[A-Za-z0-9]{32,}\b|\bBearer\s+[A-Za-z0-9._~+/-]{30,}")),
    ("pem-path", re.compile(r"[\w./\\:~-]+\.pem\b", re.I)),
    ("secret-assign", re.compile(r"\b[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY)[A-Z0-9_]*"
                                 r"\s*[=:]\s*['\"]?([A-Za-z0-9/+=_.-]{16,})")),
    ("db-url-password", re.compile(r"\b[a-z][a-z0-9+.-]*://[^\s:/@]+:([^\s@/]+)@[^\s/]+")),
]
IPV4 = re.compile(r"(?<![\w.])(\d{1,3}(?:\.\d{1,3}){3})(?![\w.])")
SLSIP = re.compile(r"\b(\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3})\.sslip\.io\b")


def tracked_files() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    return [p for p in out.decode("utf-8").split("\0") if p]


def is_text(path: Path) -> bytes | None:
    try:
        data = path.read_bytes()
    except OSError:
        return None
    return None if b"\0" in data[:4096] else data


def ip_finding(ip: str) -> str | None:
    try:
        a = ipaddress.ip_address(ip)
    except ValueError:
        return None
    if a.is_loopback or a.is_private or a.is_unspecified or a.is_multicast or a.is_link_local:
        return None
    if str(a).startswith(("192.0.2.", "198.51.100.", "203.0.113.")):
        return None  # documentation ranges
    return str(a)


def scan() -> tuple[list[tuple], list[tuple]]:
    findings: list[tuple] = []
    allowed: list[tuple] = []
    for rel in tracked_files():
        p = ROOT / rel
        if rel in SKIP_FILES or p.suffix.lower() in SKIP_SUFFIX or not p.is_file():
            continue
        data = is_text(p)
        if data is None:
            continue
        for n, line in enumerate(data.decode("utf-8", "replace").splitlines(), 1):
            if len(line) > 4000:  # minified or data line: scan only the first part
                line = line[:4000]
            for name, rx in RULES:
                for m in rx.finditer(line):
                    if name in ("secret-assign", "db-url-password") and PLACEHOLDER.search(m.group(1)):
                        continue
                    findings.append((rel, n, name, len(m.group(0))))
            for m in IPV4.finditer(line):
                ip = ip_finding(m.group(1))
                if not ip:
                    continue
                # version-like strings such as 1.2.3.4 inside package versions are very unlikely
                # to be public IPs; still report, the human decides.
                (allowed if ip in ALLOW_HOSTS else findings).append((rel, n, "ip-address", len(ip)))
            for m in SLSIP.finditer(line):
                if m.group(0) in ALLOW_HOSTS:
                    allowed.append((rel, n, "sslip-host", len(m.group(0))))
                else:
                    findings.append((rel, n, "sslip-host", len(m.group(0))))
    return findings, allowed


def main() -> int:
    findings, allowed = scan()
    n_files = len(tracked_files())
    print(f"scanned {n_files} tracked files")
    if "--list-allowed" in sys.argv:
        for rel, n, name, ln in allowed:
            print(f"  allowed {name}: {rel}:{n} (length {ln})")
    print(f"allowlisted public host/IP occurrences: {len(allowed)} in "
          f"{len({a[0] for a in allowed})} files")
    for rel, n, name, ln in findings:
        print(f"FINDING {name}: {rel}:{n} (match length {ln}, value not shown)")
    print(f"findings: {len(findings)}")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
