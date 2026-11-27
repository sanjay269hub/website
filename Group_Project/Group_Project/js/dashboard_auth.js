"use strict";

const signedInUser = document.getElementById("signed-in-user");
const logoutButton = document.getElementById("logout-button");
const roleNotice = document.getElementById("role-notice");
const manageStudentsLink = document.getElementById("manage-students-link");
const financeLink = document.getElementById("finance-link");
const viewerLink = document.getElementById("viewer-link");

// Show controls by capability, while the page-level permission check guards the dashboard itself.
if (ManningAuth.stateError) {
  roleNotice.textContent = `Account data error: ${ManningAuth.stateError}`;
  roleNotice.hidden = false;
  document.getElementById("classSelect").disabled = true;
  document.getElementById("subjectSelect").disabled = true;
  document.getElementById("saveGradesBtn").disabled = true;
} else if (ManningAuth.requirePermission("dashboard:view")) {
  const session = ManningAuth.getSession();
  signedInUser.textContent = `${session.name} (${session.role})`;

  manageStudentsLink.hidden = !ManningAuth.hasPermission("students:manage");
  financeLink.hidden = !ManningAuth.hasPermission("finance:manage");
  viewerLink.hidden = !ManningAuth.hasPermission("viewer:view");
}

logoutButton.addEventListener("click", () => {
  try {
    ManningAuth.signOut();
    location.replace("index.html");
  } catch (error) {
    roleNotice.textContent = `Unable to sign out: ${error.message}`;
    roleNotice.hidden = false;
  }
});
