export const createSecurityCenterContent = ({ openProjectSettings }) => {
  const content = document.createElement("div");
  content.className = "security-center-content";
  content.innerHTML = `
    <header class="security-center-header">
      <img src="assets/xp/system/SecurityCenterHeader.png" alt="">
      <span><strong>Security Center</strong><small>Help protect your PC</small></span>
    </header>
    <div class="security-center-body">
      <aside class="security-center-resources">
        <section>
          <h2><img src="assets/xp/system/SecurityHelp.png" alt=""> Resources <img class="security-section-toggle" src="assets/xp/system/SecurityCollapse.png" alt=""></h2>
          <button type="button">Get the latest security and virus<br>information from Microsoft</button>
          <button type="button">Check for the latest updates from<br>Windows Update</button>
          <button type="button">Get support for security-related<br>issues</button>
          <button type="button">Get help about Security Center</button>
          <button type="button">Change the way Security Center<br>alerts me</button>
        </section>
      </aside>
      <main class="security-center-main">
        <h1>Security essentials</h1>
        <p>This Windows XP reference screen does not detect or control your device’s firewall or antivirus. Astro Flash updates are managed in Astro Flash Settings.</p>
        <section class="security-status security-firewall">
          <h2><img src="assets/xp/system/SecurityFirewall.png" alt=""> <span>Firewall</span><strong><img src="assets/xp/system/SecurityStatusGreen.png" alt=""> NOT MANAGED</strong><button type="button" aria-label="Expand Firewall"><img src="assets/xp/system/SecurityExpand.png" alt=""></button></h2>
        </section>
        <section class="security-status security-updates">
          <h2><img src="assets/xp/system/SecurityAutomaticUpdates.png" alt=""> <span>Automatic Updates</span><strong><img data-security-update-indicator src="assets/xp/system/SecurityStatusYellow.png" alt=""> <b data-security-update-status>APP SETTINGS</b></strong><button type="button" aria-label="Collapse Automatic Updates"><img src="assets/xp/system/SecurityCollapse.png" alt=""></button></h2>
          <div><p>Open Astro Flash Settings to manage downloaded system files and updates.</p><button type="button" class="xp-btn" data-security-action="updates">Open Astro Flash Settings</button></div>
        </section>
        <section class="security-status security-virus">
          <h2><img src="assets/xp/system/SecurityVirusProtection.png" alt=""> <span>Virus Protection</span><strong><img src="assets/xp/system/SecurityStatusRed.png" alt=""> NOT MANAGED</strong><button type="button" aria-label="Collapse Virus Protection"><img src="assets/xp/system/SecurityCollapse.png" alt=""></button></h2>
          <div><p>This website does not inspect antivirus software on your device.</p><button type="button" class="xp-btn">Recommendations...</button></div>
        </section>
        <h2 class="security-manage-heading">Manage security settings for:</h2>
        <div class="security-manage-links">
          <button type="button"><img src="assets/xp/icons/InternetOptions.png" alt="">Internet Options</button>
          <button type="button"><img src="assets/xp/icons/WindowsFirewall.png" alt="">Windows Firewall</button>
          <button type="button"><img src="assets/xp/system/SecurityAutomaticUpdates.png" alt="">Automatic Updates</button>
        </div>
      </main>
    </div>
    <footer>Windows XP reference interface. Device security is managed outside Astro Flash.</footer>`;
  for (const button of content.querySelectorAll("button")) {
    if (button.dataset.securityAction !== "updates") {
      button.disabled = true;
      button.title =
        "Windows security settings are not controlled by this website.";
    }
  }
  content.addEventListener("click", (event) => {
    if (event.target.closest('[data-security-action="updates"]'))
      openProjectSettings();
  });
  return content;
};
