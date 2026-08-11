import { defineProgram } from "../programs/define-program.js";

const program = (id, title, icon, kind, extra = {}) =>
  defineProgram({ id, title, icon, kind, ...extra });

export const systemToolApplications = [
  program(
    "__program-access-defaults",
    "Set Program Access and Defaults",
    "ProgramAccessDefaultsSmall.png",
    "defaults",
    {
      description:
        "Choose the default programs Windows uses for common activities.",
    },
  ),
  program(
    "__windows-catalog",
    "Windows Catalog",
    "WindowsCatalog.png",
    "catalog",
    {
      description:
        "Browse the software and hardware categories available on this computer.",
    },
  ),
  program("__windows-update", "Windows Update", "WindowsUpdate.png", "update", {
    description: "Check Astro Flash Collection for available local updates.",
  }),
  program(
    "__sound-recorder",
    "Sound Recorder",
    "SoundsAudioSmall.png",
    "recorder",
    { window: { width: 450, height: 190 } },
  ),
  program("__volume-control", "Volume Control", "Volume.png", "volume", {
    window: { width: 250, height: 360 },
  }),
  program(
    "__windows-media-player",
    "Windows Media Player",
    "WindowsMediaPlayer.png",
    "media",
    { window: { width: 600, height: 420 } },
  ),
  program("__backup", "Backup", "RemovableMedia.png", "wizard"),
  program("__disk-cleanup", "Disk Cleanup", "LocalDisk.png", "disk", {
    window: { width: 430, height: 420 },
  }),
  program("__disk-defragmenter", "Disk Defragmenter", "LocalDisk.png", "disk", {
    window: { width: 430, height: 420 },
  }),
  program(
    "__files-settings-transfer",
    "Files and Settings Transfer Wizard",
    "Restore.png",
    "wizard",
  ),
  program(
    "__scheduled-tasks",
    "Scheduled Tasks",
    "ScheduledTasks.png",
    "tasks",
  ),
  program(
    "__system-information",
    "System Information",
    "System.png",
    "information",
    { window: { width: 700, height: 500 } },
  ),
  program("__system-restore", "System Restore", "Restore.png", "wizard"),
  program("__address-book", "Address Book", "AddressBook.png", "address-book"),
  program(
    "__windows-movie-maker",
    "Windows Movie Maker",
    "WindowsMovieMaker.png",
    "movie",
  ),
];
