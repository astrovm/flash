import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

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
// Each running VM listens on a socket, so other shells can drive it one
// command at a time: `bun tools/xp-vm.ts send [--instance name] <command>`.
const socketPath = (name: string) => `/tmp/astro-xp-vm-${name}.sock`;
if (Bun.argv[2] === "send") {
  let args = Bun.argv.slice(3);
  let name = "";
  if (args[0] === "--instance") {
    name = args[1] || "";
    args = args.slice(2);
  }
  if (!name) {
    const sockets = (await readdir("/tmp")).filter((file) =>
      /^astro-xp-vm-.+\.sock$/.test(file),
    );
    if (sockets.length !== 1)
      throw new Error(
        sockets.length
          ? "Several VMs are running; pass --instance"
          : "No VM is running",
      );
    name = sockets[0].slice("astro-xp-vm-".length, -".sock".length);
  }
  let reply = "";
  await new Promise<void>((resolveReply, reject) => {
    Bun.connect({
      unix: socketPath(name),
      socket: {
        open: (socket) => void socket.write(`${args.join(" ")}\n`),
        data: (_socket, data) => void (reply += data.toString()),
        close: () => resolveReply(),
        error: (_socket, error) => reject(error),
      },
    }).catch(reject);
  });
  const failed = reply.startsWith("error: ");
  (failed ? process.stderr : process.stdout).write(reply);
  process.exit(failed ? 1 : 0);
}

let instanceName = `agent-${process.pid}`;
let snapshotName: string | undefined;
let writeBase = false;
let audioOutput: string | undefined;
let sharedDirectory: string | undefined;
// Cirrus matches the original reference captures (up to 1280×1024). The
// standard adapter with the VBEMP driver adds widescreen modes at 32-bit.
let vga = "cirrus";
// No network by default. `--nic user,model=rtl8139,restrict=on` adds an
// adapter with no Internet access, for pages such as Task Manager's
// Networking.
let nic = "none";
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
  } else if (argument === "--vga") {
    vga = arguments_[++index] || "";
    if (!["cirrus", "std"].includes(vga))
      throw new Error("--vga must be cirrus or std");
  } else if (argument === "--nic") {
    nic = arguments_[++index] || "";
    if (!nic) throw new Error("--nic requires a QEMU -nic value");
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
    vga,
    // VBEMP starts in the monitor's preferred EDID mode.
    ...(vga === "std"
      ? ["-global", "VGA.xres=1920", "-global", "VGA.yres=1080"]
      : []),
    "-device",
    "piix3-usb-uhci,id=usb",
    "-device",
    "usb-tablet,bus=usb.0",
    "-nic",
    nic,
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
  `XP VM controller ready (${writeBase ? "base disk writable" : "temporary changes"}). Type 'help' for commands, or send them with: bun tools/xp-vm.ts send --instance ${screenshotInstance} <command>`,
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

// The guest's screen size, read from the PNG header of a screendump.
const idlePath = `/tmp/astro-xp-vm-${screenshotInstance}-idle.png`;
const capture = async (filename: string) => {
  await execute("screendump", { filename, format: "png" });
  return readFile(filename);
};
const screenSize = async () => {
  const png = await capture(idlePath);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
};

// Waits until the screen has stayed the same for `settle` ms, so the guest
// has finished reacting to the last input. A longer settle time rides out
// the still moments of a boot.
const waitIdle = async (timeout: number, settle: number) => {
  const started = performance.now();
  let previous = Bun.hash(await capture(idlePath));
  let stableSince = performance.now();
  while (performance.now() - started < timeout) {
    await Bun.sleep(150);
    const current = Bun.hash(await capture(idlePath));
    if (current !== previous) stableSince = performance.now();
    else if (performance.now() - stableSince >= settle) return "idle";
    previous = current;
  }
  throw new Error(`Screen still changing after ${timeout}ms`);
};

// Waits until the pixel at (x, y) has the given color, for moments a still
// screen can't mark, such as the desktop appearing after boot.
const waitPixel = async (
  x: number,
  y: number,
  hex: string,
  timeout: number,
) => {
  const started = performance.now();
  let color = "";
  while (performance.now() - started < timeout) {
    // Early boot runs at a smaller resolution, where the pixel isn't there.
    const png = await capture(idlePath);
    if (x < png.readUInt32BE(16) && y < png.readUInt32BE(20)) {
      const pixel = await sharp(png)
        .extract({ left: x, top: y, width: 1, height: 1 })
        .raw()
        .toBuffer();
      color = [...pixel.subarray(0, 3)]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
    }
    if (color === hex.toLowerCase()) return color;
    await Bun.sleep(250);
  }
  throw new Error(`Pixel (${x}, ${y}) is still ${color} after ${timeout}ms`);
};

// Runs one command and returns its output, or null to quit.
async function run(input: string): Promise<string | null> {
  const [command, ...args] = input.trim().split(/\s+/);
  let output = "";
  const log = (text: string) => (output += `${text}\n`);
  {
    if (!command) return output;
    if (command === "help") {
      log(
        "Commands: record-boot <directory>, screenshot [path], wait [timeout ms] [settle ms], until <x> <y> <rrggbb> [timeout ms], size, key <qcode> [...], chord <qcode> [...], click <x> <y> [width height] [left|right], drag <x1> <y1> <x2> <y2> [width height], save <name>, load <name>, status, quit. Clicks and drags use the screen size unless given another.",
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
      log(`Recorded ${frames.length} frames in ${directory}`);
    } else if (command === "screenshot") {
      const filename = resolve(
        sharedProjectDirectory,
        args[0] ||
          `source-media/xp-reference/current-${screenshotInstance || "agent"}.png`,
      );
      await execute("screendump", { filename, format: "png" });
      log(filename);
    } else if (command === "wait") {
      const [timeout, settle] = [args[0] || 10000, args[1] || 300].map(Number);
      if (![timeout, settle].every(Number.isFinite))
        throw new Error("wait takes a timeout and a settle time in ms");
      log(await waitIdle(timeout, settle));
    } else if (command === "until") {
      const [x, y, timeout] = [args[0], args[1], args[3] || 60000].map(Number);
      if (
        ![x, y, timeout].every(Number.isFinite) ||
        !/^[0-9a-f]{6}$/i.test(args[2] || "")
      )
        throw new Error("until requires x y rrggbb [timeout ms]");
      log(await waitPixel(x, y, args[2], timeout));
    } else if (command === "size") {
      const { width, height } = await screenSize();
      log(`${width} ${height}`);
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
      const numbers = args.filter((value) => !/^[a-z]+$/.test(value));
      const [x, y] = numbers.map(Number);
      const { width, height } =
        numbers.length === 4
          ? { width: Number(numbers[2]), height: Number(numbers[3]) }
          : await screenSize();
      if (
        (numbers.length !== 2 && numbers.length !== 4) ||
        ![x, y, width, height].every(Number.isFinite)
      )
        throw new Error("click requires x y [width height] [left|right]");
      const button = args.find((value) => /^[a-z]+$/.test(value)) || "left";
      if (button !== "left" && button !== "right")
        throw new Error("click button must be left or right");
      await click(x, y, width, height, button);
    } else if (command === "drag") {
      const [x1, y1, x2, y2] = args.map(Number);
      const { width, height } =
        args.length === 6
          ? { width: Number(args[4]), height: Number(args[5]) }
          : await screenSize();
      if (
        (args.length !== 4 && args.length !== 6) ||
        ![x1, y1, x2, y2, width, height].every(Number.isFinite) ||
        width <= 1 ||
        height <= 1
      )
        throw new Error("drag requires x1 y1 x2 y2 [width height]");
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
      log(JSON.stringify(await execute("query-status")));
    } else if (command === "quit") {
      void execute("quit");
      return null;
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  }
  return output;
}

const errorText = (error: unknown) =>
  `error: ${error instanceof Error ? error.message : error}\n`;

// One command per connection; the reply ends when the socket closes.
const socket = socketPath(screenshotInstance);
await rm(socket, { force: true });
const server = Bun.listen({
  unix: socket,
  socket: {
    data(client, data) {
      void run(data.toString())
        .then((reply) => {
          client.end(reply ?? "quit\n");
          if (reply === null) shutDown();
        })
        .catch((error) => client.end(errorText(error)));
    },
  },
});
const shutDown = () => {
  server.stop(true);
  void rm(socket, { force: true });
  void rm(idlePath, { force: true });
};
qemu.on("exit", () => {
  shutDown();
  process.exit(0);
});

const commands = createInterface({ input: process.stdin });
for await (const input of commands) {
  try {
    const reply = await run(input);
    if (reply === null) break;
    process.stdout.write(reply);
  } catch (error) {
    process.stderr.write(errorText(error));
  }
}
