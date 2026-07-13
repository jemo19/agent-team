#!/usr/bin/env node
// Fixed shell surrogate: model-controlled shell text is forwarded to the
// task-container bridge. This process never interprets it on the host.
import net from "node:net";
import process from "node:process";

const socketPath = process.env.HARBOR_CODEX_BRIDGE_SOCKET;
if (!socketPath) { console.error("bridge socket is not configured"); process.exit(125); }
const argv = process.argv.slice(2);
if (argv.length !== 2 || !["-c", "-lc"].includes(argv[0])) {
  console.error("only bash -c or bash -lc is supported"); process.exit(125);
}
const timeoutSec = Math.max(1, Math.min(Number(process.env.HARBOR_CODEX_COMMAND_TIMEOUT || "300"), 300));
const request = {id: `${process.pid}-${Date.now()}`, argv, virtual_cwd: process.cwd(), timeout_sec: timeoutSec};
const socket = net.createConnection(socketPath);
let buffer = "";
socket.setTimeout((timeoutSec + 5) * 1000, () => socket.destroy(new Error("bridge timeout")));
socket.on("connect", () => socket.write(JSON.stringify(request) + "\n"));
socket.on("data", chunk => { buffer += chunk.toString("utf8"); });
socket.on("end", () => {
  try {
    const response = JSON.parse(buffer);
    if (!response.ok) { console.error(`bridge rejected command: ${response.error}: ${response.message}`); process.exitCode = 125; return; }
    process.stdout.write(response.stdout || ""); process.stderr.write(response.stderr || "");
    if (response.truncated) process.stderr.write("\n[bridge output truncated]\n");
    process.exitCode = response.return_code;
  } catch (error) { console.error(`invalid bridge response: ${error.message}`); process.exitCode = 125; }
});
socket.on("error", error => { console.error(`bridge error: ${error.message}`); process.exitCode = 125; });
