import { mkdir, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gitDirectoryResult = spawnSync(
  "git",
  ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  { cwd: projectDirectory, encoding: "utf8" },
);
const commonGitDirectory =
  gitDirectoryResult.status === 0 ? gitDirectoryResult.stdout.trim() : "";
const sharedProjectDirectory = commonGitDirectory
  ? dirname(commonGitDirectory)
  : projectDirectory;
const isoPath = resolve(
  sharedProjectDirectory,
  "source-media/en_windows_xp_professional_with_service_pack_3_x86_cd_vl_x14-73974.iso",
);
const diskPath = resolve(
  sharedProjectDirectory,
  "source-media/xp-vm/windows-xp.qcow2",
);
let instanceName = `agent-${process.pid}`;
let snapshotName: string | undefined;
let writeBase = false;
let audioOutput: string | undefined;
let sharedDirectory: string | undefined;
const arguments_ = Bun.argv.slice(2);
for (let index = 0; index < arguments_.length; index += 1) {
  const argument = arguments_[index];
  if (argument === "--instance") {
    instanceName = arguments_[index + 1] || "";
    if (!instanceName) throw new Error("--instance requires a name");
    index += 1;
  } else if (argument === "--snapshot") {
    snapshotName = arguments_[index + 1];
    if (!snapshotName) throw new Error("--snapshot requires a name");
    index += 1;
  } else if (argument === "--audio-output" || argument === "--share") {
    const value = arguments_[++index];
    if (!value) throw new Error(`${argument} requires a path`);
    if (argument === "--audio-output") audioOutput = resolve(value);
    else sharedDirectory = resolve(value);
  } else if (argument === "--write-base") {
    writeBase = true;
  } else {
    throw new Error(`Unknown argument: ${argument}`);
  }
}
const screenshotInstance = instanceName
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "");

const qemu = spawn(
  "qemu-system-i386",
  [
    "-name",
    `Astro XP Reference (${instanceName})`,
    "-machine",
    "pc,accel=tcg",
    "-cpu",
    "pentium3",
    "-smp",
    "1",
    "-m",
    "512",
    ...(writeBase ? [] : ["-snapshot"]),
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
    ...(audioOutput
      ? [
          "-audiodev",
          `wav,id=reference,path=${audioOutput}`,
          "-device",
          "AC97,audiodev=reference",
        ]
      : []),
    ...(sharedDirectory
      ? [
          "-drive",
          `file=fat:rw:${sharedDirectory},format=raw,if=ide,snapshot=off`,
        ]
      : []),
    "-rtc",
    "base=localtime",
    "-display",
    "cocoa",
    "-qmp",
    "stdio",
    ...(snapshotName ? ["-loadvm", snapshotName] : []),
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
console.log(
  `XP VM controller ready (${writeBase ? "base disk writable" : "temporary changes"}). Type 'help' for commands.`,
);

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

async function click(
  x: number,
  y: number,
  width: number,
  height: number,
  button: "left" | "right",
) {
  const absoluteX = Math.round((x / (width - 1)) * 0x7fff);
  const absoluteY = Math.round((y / (height - 1)) * 0x7fff);
  await execute("input-send-event", {
    events: [
      { type: "abs", data: { axis: "x", value: absoluteX } },
      { type: "abs", data: { axis: "y", value: absoluteY } },
    ],
  });
  await execute("input-send-event", {
    events: [{ type: "btn", data: { down: true, button } }],
  });
  await Bun.sleep(75);
  await execute("input-send-event", {
    events: [{ type: "btn", data: { down: false, button } }],
  });
}

const commands = createInterface({ input: process.stdin });
for await (const input of commands) {
  const [command, ...args] = input.trim().split(/\s+/);
  try {
    if (!command) continue;
    if (command === "help") {
      console.log(
        "Commands: record-boot <directory>, screenshot <path>, key <qcode> [...], chord <qcode> [...], click <x> <y> [width height] [left|right], drag <x1> <y1> <x2> <y2> <width> <height>, save <name>, load <name>, status, quit",
      );
    } else if (command === "record-boot") {
      if (!args[0]) throw new Error("record-boot requires an output directory");
      const directory = resolve(args[0]);
      await mkdir(directory, { recursive: true });
      await execute("system_reset");
      const started = performance.now();
      const frames: Array<{ file: string; elapsedMs: number }> = [];
      while (performance.now() - started < 20000) {
        const file = `${String(frames.length).padStart(4, "0")}.png`;
        const elapsedMs = performance.now() - started;
        await execute("screendump", {
          filename: resolve(directory, file),
          format: "png",
        });
        frames.push({ file, elapsedMs });
        await Bun.sleep(50);
      }
      await writeFile(
        resolve(directory, "frames.json"),
        JSON.stringify(frames, null, 2),
      );
      console.log(`Recorded ${frames.length} frames in ${directory}`);
    } else if (command === "screenshot") {
      const filename = resolve(
        sharedProjectDirectory,
        args[0] ||
          `source-media/xp-reference/current-${screenshotInstance || "agent"}.png`,
      );
      await execute("screendump", { filename, format: "png" });
      console.log(filename);
    } else if (command === "key") {
      for (const key of args) await pressKey(key);
    } else if (command === "chord") {
      await execute("input-send-event", {
        events: [
          ...args.map((key) => ({
            type: "key",
            data: { down: true, key: { type: "qcode", data: key } },
          })),
          ...args.toReversed().map((key) => ({
            type: "key",
            data: { down: false, key: { type: "qcode", data: key } },
          })),
        ],
      });
    } else if (command === "click") {
      const [x, y, width = 640, height = 480] = args.slice(0, 4).map(Number);
      if (![x, y, width, height].every(Number.isFinite))
        throw new Error("click requires x y [width height] [left|right]");
      const button = args[4] || "left";
      if (button !== "left" && button !== "right")
        throw new Error("click button must be left or right");
      await click(x, y, width, height, button);
    } else if (command === "drag") {
      const [x1, y1, x2, y2, width, height] = args.map(Number);
      if (
        args.length !== 6 ||
        ![x1, y1, x2, y2, width, height].every(Number.isFinite) ||
        width <= 1 ||
        height <= 1
      )
        throw new Error("drag requires x1 y1 x2 y2 width height");
      const move = (x: number, y: number) =>
        execute("input-send-event", {
          events: [
            {
              type: "abs",
              data: {
                axis: "x",
                value: Math.round((x / (width - 1)) * 0x7fff),
              },
            },
            {
              type: "abs",
              data: {
                axis: "y",
                value: Math.round((y / (height - 1)) * 0x7fff),
              },
            },
          ],
        });
      await move(x1, y1);
      // Let the guest deliver the initial motion before pressing the button.
      await Bun.sleep(100);
      await execute("input-send-event", {
        events: [{ type: "btn", data: { down: true, button: "left" } }],
      });
      await Bun.sleep(100);
      try {
        for (let step = 1; step <= 20; step++) {
          await move(
            x1 + ((x2 - x1) * step) / 20,
            y1 + ((y2 - y1) * step) / 20,
          );
          await Bun.sleep(30);
        }
      } finally {
        await execute("input-send-event", {
          events: [{ type: "btn", data: { down: false, button: "left" } }],
        });
      }
    } else if (command === "save" || command === "load") {
      if (!args[0]) throw new Error(`${command} requires a snapshot name`);
      await execute("human-monitor-command", {
        "command-line": `${command === "save" ? "savevm" : "loadvm"} ${args[0]}`,
      });
    } else if (command === "status") {
      console.log(JSON.stringify(await execute("query-status")));
    } else if (command === "quit") {
      void execute("quit");
      break;
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}
