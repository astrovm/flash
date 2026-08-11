"use strict";

const XP_NATIVE_PROGRAMS = Object.freeze({
  "__program-access-defaults": {
    title: "Set Program Access and Defaults",
    icon: "ProgramAccessDefaultsSmall.png",
    kind: "defaults",
    description:
      "Choose the default programs Windows uses for common activities.",
  },
  "__windows-catalog": {
    title: "Windows Catalog",
    icon: "WindowsCatalog.png",
    kind: "catalog",
    description:
      "Browse the software and hardware categories available on this computer.",
  },
  "__windows-update": {
    title: "Windows Update",
    icon: "WindowsUpdate.png",
    kind: "update",
    description: "Check Astro Flash Collection for available local updates.",
  },
  "__accessibility-wizard": {
    title: "Accessibility Wizard",
    icon: "AccessibilityOptions.png",
    kind: "wizard",
  },
  __magnifier: { title: "Magnifier", icon: "Magnifier.png", kind: "tool" },
  __narrator: {
    title: "Narrator",
    icon: "AccessibilitySound.png",
    kind: "tool",
  },
  "__on-screen-keyboard": {
    title: "On-Screen Keyboard",
    icon: "OnScreenKeyboard.png",
    kind: "keyboard",
  },
  "__utility-manager": {
    title: "Utility Manager",
    icon: "AccessibilityOptions.png",
    kind: "utility-manager",
  },
  __hyperterminal: {
    title: "HyperTerminal",
    icon: "CommandPrompt.png",
    kind: "hyperterminal",
  },
  "__network-connections": {
    title: "Network Connections",
    icon: "NetworkConnections.png",
    kind: "network",
  },
  "__network-setup-wizard": {
    title: "Network Setup Wizard",
    icon: "NetworkSetupWizard.png",
    kind: "wizard",
  },
  "__new-connection-wizard": {
    title: "New Connection Wizard",
    icon: "NetworkConnection.png",
    kind: "wizard",
  },
  "__wireless-network-setup-wizard": {
    title: "Wireless Network Setup Wizard",
    icon: "WirelessNetworkSetupWizard.png",
    kind: "wizard",
  },
  "__sound-recorder": {
    title: "Sound Recorder",
    icon: "SoundsAudioSmall.png",
    kind: "recorder",
  },
  "__volume-control": {
    title: "Volume Control",
    icon: "Volume.png",
    kind: "volume",
  },
  "__windows-media-player": {
    title: "Windows Media Player",
    icon: "WindowsMediaPlayer.png",
    kind: "media",
  },
  __backup: { title: "Backup", icon: "RemovableMedia.png", kind: "wizard" },
  "__character-map": {
    title: "Character Map",
    icon: "Fonts.png",
    kind: "character-map",
  },
  "__disk-cleanup": {
    title: "Disk Cleanup",
    icon: "LocalDisk.png",
    kind: "disk",
  },
  "__disk-defragmenter": {
    title: "Disk Defragmenter",
    icon: "LocalDisk.png",
    kind: "disk",
  },
  "__files-settings-transfer": {
    title: "Files and Settings Transfer Wizard",
    icon: "Restore.png",
    kind: "wizard",
  },
  "__scheduled-tasks": {
    title: "Scheduled Tasks",
    icon: "ScheduledTasks.png",
    kind: "tasks",
  },
  "__system-information": {
    title: "System Information",
    icon: "System.png",
    kind: "information",
  },
  "__system-restore": {
    title: "System Restore",
    icon: "Restore.png",
    kind: "wizard",
  },
  "__address-book": {
    title: "Address Book",
    icon: "AddressBook.png",
    kind: "address-book",
  },
  __calculator: {
    title: "Calculator",
    icon: "Calculator.png",
    kind: "calculator",
  },
  "__command-prompt": {
    title: "Command Prompt",
    icon: "CommandPrompt.png",
    kind: "terminal",
  },
  __paint: { title: "Paint", icon: "Paint.png", kind: "paint" },
  "__program-compatibility-wizard": {
    title: "Program Compatibility Wizard",
    icon: "ProgramCompatibilityWizard.png",
    kind: "wizard",
  },
  "__remote-desktop": {
    title: "Remote Desktop Connection",
    icon: "RemoteDesktopConnection.png",
    kind: "remote",
  },
  __synchronize: {
    title: "Synchronize",
    icon: "Synchronize.png",
    kind: "sync",
  },
  "__tour-windows-xp": {
    title: "Tour Windows XP",
    icon: "TourWindowsXP.png",
    kind: "tour",
  },
  __wordpad: { title: "WordPad", icon: "WordPad.png", kind: "editor" },
  "__internet-explorer": {
    title: "Internet Explorer",
    icon: "InternetExplorer.png",
    kind: "browser",
  },
  __msn: { title: "MSN", icon: "MSN.png", kind: "browser" },
  "__outlook-express": {
    title: "Outlook Express",
    icon: "OutlookExpress.png",
    kind: "mail",
  },
  "__remote-assistance": {
    title: "Remote Assistance",
    icon: "RemoteAssistance.png",
    kind: "wizard",
  },
  "__windows-messenger": {
    title: "Windows Messenger",
    icon: "WindowsMessenger.png",
    kind: "messenger",
  },
  "__windows-movie-maker": {
    title: "Windows Movie Maker",
    icon: "WindowsMovieMaker.png",
    kind: "movie",
  },
  __freecell: {
    title: "FreeCell",
    icon: "FreeCell.png",
    kind: "native-game",
  },
  __hearts: { title: "Hearts", icon: "Hearts.png", kind: "native-game" },
  "__internet-backgammon": {
    title: "Internet Backgammon",
    icon: "InternetBackgammon.png",
    kind: "native-game",
  },
  "__internet-checkers": {
    title: "Internet Checkers",
    icon: "InternetCheckers.png",
    kind: "native-game",
  },
  "__internet-hearts": {
    title: "Internet Hearts",
    icon: "InternetHearts.png",
    kind: "native-game",
  },
  "__internet-reversi": {
    title: "Internet Reversi",
    icon: "InternetReversi.png",
    kind: "native-game",
  },
  "__internet-spades": {
    title: "Internet Spades",
    icon: "InternetSpades.png",
    kind: "native-game",
  },
  __minesweeper: {
    title: "Minesweeper",
    icon: "Minesweeper.png",
    kind: "native-game",
  },
  __pinball: {
    title: "Pinball",
    icon: "Pinball.png",
    kind: "native-game",
  },
  __solitaire: {
    title: "Solitaire",
    icon: "Solitaire.png",
    kind: "native-game",
  },
  "__spider-solitaire": {
    title: "Spider Solitaire",
    icon: "SpiderSolitaire.png",
    kind: "native-game",
  },
});

const XPApplicationRegistry = Object.freeze({
  get(programId) {
    return XP_NATIVE_PROGRAMS[programId] || null;
  },
  entries() {
    return Object.entries(XP_NATIVE_PROGRAMS);
  },
  values() {
    return Object.values(XP_NATIVE_PROGRAMS);
  },
});
