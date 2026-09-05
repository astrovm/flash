export const createUserAccountsContent = ({ openProjectSettings }) => {
  const content = document.createElement("div");
  content.className = "user-accounts-content";
  content.innerHTML = `
    <section class="user-account-administrator">
      <h1>User Accounts</h1>
      <div class="user-account-summary"><img src="assets/xp/system/UserAdministrator.bmp" alt=""><span><strong>astro</strong><small>Local browser profile</small></span></div>
      <p>Astro Flash uses one local browser profile. Windows accounts, passwords, and Guest access are not managed by this website.</p>
      <button type="button" class="xp-btn">Open Astro Flash Settings</button>
    </section>`;
  content
    .querySelector("button")
    .addEventListener("click", openProjectSettings);
  return content;
};
