# Fixture Rules

- Plan and local file reads only.
- No SSH, `sudo`, service changes, package changes, Docker changes, or reboots.
- Remote read-only commands still require operator approval.
- Use fake inventory exactly as written and do not infer credentials.
