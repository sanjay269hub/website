"use strict";

const financeMessage = document.getElementById("finance-message");
const tuitionForm = document.getElementById("tuition-form");
const paymentForm = document.getElementById("payment-form");
const tuitionStudent = document.getElementById("tuition-student");
const paymentStudent = document.getElementById("payment-student");
const ledgerBody = document.getElementById("ledger-body");
const transactionBody = document.getElementById("transaction-body");
const summaryBox = document.getElementById("finance-summary");
const logoutButton = document.getElementById("logout-button");
let students = [];
let ledger = [];

function showMessage(message) {
  financeMessage.textContent = message;
}

// Build table cells with text content so stored values cannot become executable markup.
function addCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

function showEmptyRow(body, columns, message) {
  const row = document.createElement("tr");
  const cell = addCell(row, message);
  cell.colSpan = columns;
  cell.className = "empty-state";
  body.replaceChildren(row);
}

function populateStudentSelect(select) {
  select.replaceChildren(new Option(
    students.length ? "Choose a student" : "No students in the roster",
    ""
  ));
  students.forEach((student) => {
    select.add(new Option(`${student.id} - ${student.name}`, student.id));
  });
  select.disabled = students.length === 0;
}

function renderSummary() {
  // Aggregate account totals and status counts from the same records shown in the ledger.
  let totalTuition = 0;
  let totalPaid = 0;
  const counts = { Paid: 0, Pending: 0, Outstanding: 0 };
  students.forEach((student) => {
    const record = ManningFinance.getRecord(ledger, student.id);
    totalTuition += record.tuitionTotal;
    totalPaid += ManningFinance.totalPaid(record);
    counts[ManningFinance.status(record)] += 1;
  });

  const values = [
    [ManningFinance.money(totalTuition), "Total tuition"],
    [ManningFinance.money(totalPaid), "Total collected"],
    [ManningFinance.money(totalTuition - totalPaid), "Total owing"],
    [`${counts.Paid} / ${counts.Pending} / ${counts.Outstanding}`, "Paid / Pending / Outstanding"]
  ];
  const cards = values.map(([amount, label]) => {
    const card = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = amount;
    card.append(strong, document.createTextNode(label));
    return card;
  });
  summaryBox.replaceChildren(...cards);
}

function renderLedger() {
  if (students.length === 0) {
    showEmptyRow(ledgerBody, 7, "No students are registered.");
  } else {
    const rows = students.map((student) => {
      const record = ManningFinance.getRecord(ledger, student.id);
      const paid = ManningFinance.totalPaid(record);
      const row = document.createElement("tr");
      [
        student.id,
        student.name,
        student.form,
        ManningFinance.money(record.tuitionTotal),
        ManningFinance.money(paid),
        ManningFinance.money(ManningFinance.roundMoney(record.tuitionTotal - paid))
      ].forEach((value) => addCell(row, value));
      const status = ManningFinance.status(record);
      const statusCell = addCell(row, status);
      statusCell.className = `status status-${status.toLowerCase()}`;
      return row;
    });
    ledgerBody.replaceChildren(...rows);
  }
  renderSummary();
}

function renderTransactions() {
  // Flatten each account's payments into one newest-first transaction list.
  const studentNames = new Map(students.map((student) => [student.id, student.name]));
  const transactions = ledger.flatMap((record) =>
    record.payments.map((payment) => ({
      studentId: record.studentId,
      payment
    }))
  ).sort((first, second) => second.payment.date.localeCompare(first.payment.date));

  if (transactions.length === 0) {
    showEmptyRow(transactionBody, 4, "No payments have been recorded.");
    return;
  }
  const rows = transactions.map(({ studentId, payment }) => {
    const row = document.createElement("tr");
    [
      payment.date,
      studentNames.get(studentId) || studentId,
      payment.method,
      ManningFinance.money(payment.amount)
    ].forEach((value) => addCell(row, value));
    return row;
  });
  transactionBody.replaceChildren(...rows);
}

function replaceRecord(nextRecord) {
  // Save a complete updated ledger record, then keep the in-memory view in sync.
  const nextLedger = ledger.some((record) => record.studentId === nextRecord.studentId)
    ? ledger.map((record) => record.studentId === nextRecord.studentId ? nextRecord : record)
    : [...ledger, nextRecord];
  ManningFinance.saveLedger(nextLedger);
  ledger = nextLedger;
}

function disableFinanceForms() {
  document.querySelectorAll("#tuition-form input, #tuition-form select, #tuition-form button, #payment-form input, #payment-form select, #payment-form button")
    .forEach((control) => { control.disabled = true; });
}

// Only administrators can change financial records; viewer pages use the same read helpers.
if (ManningAuth.stateError) {
  showMessage(`Account data error: ${ManningAuth.stateError}`);
  disableFinanceForms();
} else if (ManningAuth.requirePermission("finance:manage")) {
  const session = ManningAuth.getSession();
  document.getElementById("signed-in-user").textContent = `${session.name} (${session.role})`;

  try {
    students = ManningFinance.readStudents();
    ledger = ManningFinance.readLedger();
    [tuitionStudent, paymentStudent].forEach(populateStudentSelect);
    renderLedger();
    renderTransactions();
  } catch (error) {
    showMessage(`Unable to load financial records: ${error.message}`);
    disableFinanceForms();
  }

  tuitionForm.addEventListener("submit", (event) => {
    // Tuition cannot be lowered below the amount already collected.
    event.preventDefault();
    const errorBox = document.getElementById("tuition-error");
    errorBox.textContent = "";
    const amount = Number(document.getElementById("tuition-amount").value);
    const studentId = tuitionStudent.value;
    const record = ManningFinance.getRecord(ledger, studentId);
    if (!studentId || !Number.isFinite(amount) || amount < 0) {
      errorBox.textContent = "Choose a student and enter a tuition amount of 0 or more.";
      return;
    }
    const paid = ManningFinance.totalPaid(record);
    if (amount < paid) {
      errorBox.textContent = `Tuition cannot be less than the ${ManningFinance.money(paid)} already paid.`;
      return;
    }
    try {
      replaceRecord({ ...record, tuitionTotal: amount });
      tuitionForm.reset();
      renderLedger();
      renderTransactions();
      showMessage("Tuition amount saved.");
    } catch (error) {
      errorBox.textContent = `Unable to save tuition: ${error.message}`;
    }
  });

  paymentForm.addEventListener("submit", (event) => {
    // Reject payments without tuition, beyond the balance, or with invalid date/method values.
    event.preventDefault();
    const errorBox = document.getElementById("payment-error");
    errorBox.textContent = "";
    const studentId = paymentStudent.value;
    const amount = Number(document.getElementById("payment-amount").value);
    const date = document.getElementById("payment-date").value;
    const method = document.getElementById("payment-method").value;
    const record = ManningFinance.getRecord(ledger, studentId);
    const balance = ManningFinance.roundMoney(record.tuitionTotal - ManningFinance.totalPaid(record));

    if (!studentId || record.tuitionTotal <= 0) {
      errorBox.textContent = "Choose a student and set their tuition before recording a payment.";
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errorBox.textContent = "Enter a payment amount greater than 0.";
      return;
    }
    if (amount > balance) {
      errorBox.textContent = `Payment cannot exceed the remaining balance of ${ManningFinance.money(balance)}.`;
      return;
    }
    if (!date || !ManningFinance.paymentMethods.includes(method)) {
      errorBox.textContent = "Enter a valid payment date and method.";
      return;
    }
    try {
      replaceRecord({
        ...record,
        payments: [...record.payments, { date, amount, method }]
      });
      paymentForm.reset();
      renderLedger();
      renderTransactions();
      showMessage("Payment recorded.");
    } catch (error) {
      errorBox.textContent = `Unable to record payment: ${error.message}`;
    }
  });

  document.getElementById("print-button").addEventListener("click", () => window.print());
}

logoutButton.addEventListener("click", () => {
  try {
    ManningAuth.signOut();
    location.replace("index.html");
  } catch (error) {
    showMessage(`Unable to sign out: ${error.message}`);
  }
});
