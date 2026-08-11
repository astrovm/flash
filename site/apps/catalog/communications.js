import { defineProgram } from "../programs/define-program.js";

const program = (id, title, icon, kind, extra = {}) =>
  defineProgram({ id, title, icon, kind, ...extra });

export const communicationApplications = [
  program(
    "__hyperterminal",
    "HyperTerminal",
    "CommandPrompt.png",
    "hyperterminal",
    { window: { width: 560, height: 420 } },
  ),
  program(
    "__network-connections",
    "Network Connections",
    "NetworkConnections.png",
    "network",
  ),
  program(
    "__network-setup-wizard",
    "Network Setup Wizard",
    "NetworkSetupWizard.png",
    "wizard",
  ),
  program(
    "__new-connection-wizard",
    "New Connection Wizard",
    "NetworkConnection.png",
    "wizard",
  ),
  program(
    "__wireless-network-setup-wizard",
    "Wireless Network Setup Wizard",
    "WirelessNetworkSetupWizard.png",
    "wizard",
  ),
  program(
    "__internet-explorer",
    "Internet Explorer",
    "InternetExplorer.png",
    "browser",
  ),
  program("__msn", "MSN", "MSN.png", "browser"),
  program(
    "__outlook-express",
    "Outlook Express",
    "OutlookExpress.png",
    "mail",
    { window: { width: 720, height: 520 } },
  ),
  program(
    "__remote-assistance",
    "Remote Assistance",
    "RemoteAssistance.png",
    "wizard",
  ),
  program(
    "__windows-messenger",
    "Windows Messenger",
    "WindowsMessenger.png",
    "messenger",
    { window: { width: 500, height: 460 } },
  ),
];
