import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isoPath = resolve(
  projectDirectory,
  "source-media/en_windows_xp_professional_with_service_pack_3_x86_cd_vl_x14-73974.iso",
);
const diskPath = resolve(
  projectDirectory,
  "source-media/xp-vm/windows-xp.qcow2",
);

const qemu = spawn(
  "qemu-system-i386",
  [
    "-name",
    "Astro XP Reference",
    "-machine",
    "pc,accel=tcg",
    "-cpu",
    "pentium3",
    "-smp",
    "1",
    "-m",
    "512",
    "-drive",
    `file=${diskPath},format=qcow2,if=ide`,
    "-cdrom",
    isoPath,
    "-boot",
    "c",
    "-vga",
    "cirrus",
    "-device",
    "piix3-usb-uhci,id=usb",
    "-device",
    "usb-tablet,bus=usb.0",
    "-nic",
    "none",
    "-rtc",
    "base=localtime",
    "-display",
    "cocoa",
    "-qmp",
    "stdio",
  ],
  { cwd: projectDirectory, stdio: ["pipe", "pipe", "inherit"] },
);

type QmpResponse = {
  QMP?: unknown;
  id?: number;
  return?: unknown;
  error?: { class: string; desc: string };
};

let nextId = 1;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

function execute(command: string, argumentsValue?: unknown) {
  const id = nextId++;
  const result = new Promise<unknown>((resolveResult, reject) => {
    pending.set(id, { resolve: resolveResult, reject });
  });
  qemu.stdin.write(
    `${JSON.stringify({
      execute: command,
      ...(argumentsValue ? { arguments: argumentsValue } : {}),
      id,
    })}\n`,
  );
  return result;
}

let resolveGreeting: () => void;
const greeting = new Promise<void>((resolveGreetingValue) => {
  resolveGreeting = resolveGreetingValue;
});

createInterface({ input: qemu.stdout }).on("line", (line) => {
  const response = JSON.parse(line) as QmpResponse;
  if (response.QMP) resolveGreeting();
  if (response.id === undefined) return;
  const request = pending.get(response.id);
  if (!request) return;
  pending.delete(response.id);
  if (response.error) {
    request.reject(
      new Error(`${response.error.class}: ${response.error.desc}`),
    );
  } else {
    request.resolve(response.return);
  }
});

await greeting;
await execute("qmp_capabilities");
console.log("XP VM controller ready. Type 'help' for commands.");

async function pressKey(qcode: string) {
  await execute("input-send-event", {
    events: [
      {
        type: "key",
        data: { down: true, key: { type: "qcode", data: qcode } },
      },
      {
        type: "key",
        data: { down: false, key: { type: "qcode", data: qcode } },
      },
    ],
  });
}

async function typeProductKey() {
  const extracted = spawnSync(
    "7z",
    ["e", "-so", isoPath, "I386/UNATTEND.TXT"],
    { encoding: "utf8" },
  );
  if (extracted.status !== 0)
    throw new Error("Unable to read XP setup metadata");
  const match = extracted.stdout.match(/ProductKey\s*=\s*"?([A-Z0-9-]{29})"?/i);
  if (!match) throw new Error("No Volume License key found in the XP ISO");
  for (const character of match[1].replaceAll("-", "").toLowerCase()) {
    await pressKey(character);
    await Bun.sleep(100);
  }
  console.log("Injected the ISO-provided product key without logging it.");
}

const commands = createInterface({ input: process.stdin });
for await (const input of commands) {
  const [command, ...args] = input.trim().split(/\s+/);
  try {
    if (!command) continue;
    if (command === "help") {
      console.log(
        "Commands: screenshot <path>, key <qcode> [...], product-key, save <name>, load <name>, status, quit",
      );
    } else if (command === "screenshot") {
      const filename = resolve(
        projectDirectory,
        args[0] || "source-media/xp-reference/current.png",
      );
      await execute("screendump", { filename, format: "png" });
      console.log(filename);
    } else if (command === "key") {
      for (const key of args) await pressKey(key);
    } else if (command === "product-key") {
      await typeProductKey();
    } else if (command === "save" || command === "load") {
      if (!args[0]) throw new Error(`${command} requires a snapshot name`);
      await execute("human-monitor-command", {
        commandLine: `${command === "save" ? "savevm" : "loadvm"} ${args[0]}`,
      });
    } else if (command === "status") {
      console.log(JSON.stringify(await execute("query-status")));
    } else if (command === "quit") {
      await execute("quit");
      break;
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}
