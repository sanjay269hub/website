const menuButton = document.getElementById("menu-button");
const mainNavigation = document.getElementById("main-nav");

// Keep the mobile menu state in sync for both keyboard and assistive-technology users.
if (menuButton && mainNavigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = mainNavigation.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}
