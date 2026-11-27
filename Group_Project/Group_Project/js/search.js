"use strict";

const financeMessage = document.getElementById("finance-message");
const searchText = document.getElementById("search-text");
const filterCohort = document.getElementById("filter-cohort");
const filterStatus = document.getElementById("filter-status");
const searchForm = document.getElementById("search-form");
const searchBody = document.getElementById("search-body");
const resultCount = document.getElementById("result-count");
const logoutButton = document.getElementById("logout-button");
let students = [];
let ledger = [];

// Render filtered financial records with DOM text nodes (the search page is read-only).
function addCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

function renderResults(matches) {
  resultCount.textContent = `${matches.length} of ${students.length} students shown`;
  if (matches.length === 0) {
    const row = document.createElement("tr");
    const cell = addCell(row, "No student accounts match these filters.");
    cell.colSpan = 6;
    cell.className = "empty-state";
    searchBody.replaceChildren(row);
    return;
  }

  const rows = matches.map((student) => {
    const record = ManningFinance.getRecord(ledger, student.id);
    const paid = ManningFinance.totalPaid(record);
    const status = ManningFinance.status(record);
    const row = document.createElement("tr");
    [
      student.id,
      student.name,
      student.form,
      ManningFinance.money(record.tuitionTotal),
      ManningFinance.money(ManningFinance.roundMoney(record.tuitionTotal - paid))
    ].forEach((value) => addCell(row, value));
    const statusCell = addCell(row, status);
    statusCell.className = `status status-${status.toLowerCase()}`;
    return row;
  });
  searchBody.replaceChildren(...rows);
}

function applyFilters() {
  // A result must match the text, form and payment-status filters together.
  const query = searchText.value.trim().toLocaleLowerCase();
  const form = filterCohort.value;
  const status = filterStatus.value;
  const matches = students.filter((student) => {
    const matchesText = !query ||
      student.name.toLocaleLowerCase().includes(query) ||
      student.id.toLocaleLowerCase().includes(query);
    const matchesForm = form === "All" || student.form === form;
    const matchesStatus = status === "All" ||
      ManningFinance.status(ManningFinance.getRecord(ledger, student.id)) === status;
    return matchesText && matchesForm && matchesStatus;
  });
  renderResults(matches);
}

// Restrict financial search to the same admin capability as the editable ledger.
if (ManningAuth.stateError) {
  financeMessage.textContent = `Account data error: ${ManningAuth.stateError}`;
} else if (ManningAuth.requirePermission("finance:manage")) {
  const session = ManningAuth.getSession();
  document.getElementById("signed-in-user").textContent = `${session.name} (${session.role})`;
  try {
    students = ManningFinance.readStudents();
    ledger = ManningFinance.readLedger();
    const forms = [...new Set(students.map((student) => student.form))].sort();
    forms.forEach((form) => filterCohort.add(new Option(form, form)));
    applyFilters();
  } catch (error) {
    financeMessage.textContent = `Unable to load financial records: ${error.message}`;
    resultCount.textContent = "Search is unavailable until the saved data is corrected.";
  }

  searchText.addEventListener("input", applyFilters);
  filterCohort.addEventListener("change", applyFilters);
  filterStatus.addEventListener("change", applyFilters);
  searchForm.addEventListener("reset", () => setTimeout(applyFilters, 0));
  document.getElementById("print-button").addEventListener("click", () => window.print());
}

logoutButton.addEventListener("click", () => {
  try {
    ManningAuth.signOut();
    location.replace("index.html");
  } catch (error) {
    financeMessage.textContent = `Unable to sign out: ${error.message}`;
  }
});
