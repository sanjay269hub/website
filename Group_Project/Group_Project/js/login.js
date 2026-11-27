"use strict";

const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

function showLoginError(message) {
  loginMessage.textContent = message;
  loginMessage.hidden = false;
}

// Initialize login only after account storage is valid and no session is already active.
if (ManningAuth.stateError) {
  showLoginError(`Unable to initialize account data: ${ManningAuth.stateError}`);
  loginForm.querySelector("button[type='submit']").disabled = true;
} else if (ManningAuth.getSession()) {
  location.replace(ManningAuth.hasPermission("dashboard:view") ? "teacher_dashboard.html" : "viewer.html");
} else {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      if (!ManningAuth.signIn(usernameInput.value, passwordInput.value)) {
        showLoginError("The username or password is incorrect.");
        passwordInput.value = "";
        passwordInput.focus();
        return;
      }

      // Honor only known destinations allowed by the signed-in role.
      const requestedPage = new URLSearchParams(location.search).get("next");
      const allowedPage =
        (requestedPage === "student_admin.html" && ManningAuth.hasPermission("students:manage")) ||
        (requestedPage === "viewer.html" && ManningAuth.hasPermission("viewer:view"));
      const defaultPage = ManningAuth.hasPermission("dashboard:view")
        ? "teacher_dashboard.html"
        : "viewer.html";
      location.replace(allowedPage ? requestedPage : defaultPage);
    } catch (error) {
      showLoginError(`Unable to sign in: ${error.message}`);
    }
  });
}
