/*
Name of Group Member & ID#:
Tishauna Dawes-2307076
Aundre Chamber-2303820
Indera Mills-2307650
Sanjay Finley-2007397

Day/Time of Lab: Friday @7pm
*/

"use strict";

const contactForm = document.getElementById("contactus-form");
const contactMessage = document.getElementById("contact-message");
const MESSAGE_STORAGE_KEY = "messages";

function showMessage(text, isError = false) {
  contactMessage.textContent = text;
  contactMessage.classList.toggle("is-error", isError);
  contactMessage.classList.toggle("is-success", !isError);
}

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;

  const message = {
    name: document.getElementById("fullname").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    topic: document.getElementById("topic").value,
    message: document.getElementById("message").value.trim(),
    date: new Date().toISOString()
  };

  if (message.name.length < 2 || message.message.length < 15) {
    showMessage("Please enter a name and a message that meets the minimum length.", true);
    return;
  }

  try {
    const storedMessages = localStorage.getItem(MESSAGE_STORAGE_KEY);
    const messages = storedMessages === null ? [] : JSON.parse(storedMessages);
    if (!Array.isArray(messages)) {
      showMessage("Saved messages are invalid. Clear the browser's messages storage before trying again.", true);
      return;
    }

    messages.push(message);
    localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    showMessage(`Unable to save the message in this browser: ${error.message}`, true);
    return;
  }

  contactForm.reset();
  showMessage("Message sent.");
});