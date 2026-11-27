"use strict";

const viewerMessage = document.getElementById("viewer-message");
const studentPick = document.getElementById("student-pick");
const statement = document.getElementById("statement");
const reportForm = document.getElementById("report-form");
const reportStats = document.getElementById("report-stats");
const reportBody = document.getElementById("report-body");
const logoutButton = document.getElementById("logout-button");
let students = [];
let ledger = [];
let canViewFinance = false;

// Academic results use the same 40/60 weights and grade bands as the teacher dashboard.
function calculateTotal(student) {
  const coursework = Number(student.coursework) || 0;
  const exam = Number(student.exam) || 0;
  return Number(((coursework * 0.4) + (exam * 0.6)).toFixed(1));
}

function gradeFor(total) {
  if (total >= 80) return "A";
  if (total >= 65) return "B";
  if (total >= 50) return "C";
  return "F";
}

function addLine(parent, label, value) {
  const line = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  line.append(strong, document.createTextNode(String(value)));
  parent.appendChild(line);
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = String(value);
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

function renderStatement() {
  // Show tuition details only to roles with finance management permission.
  const student = students.find((record) => record.id === studentPick.value);
  if (!student) {
    statement.replaceChildren(Object.assign(document.createElement("p"), {
      textContent: "Select a student to view their profile and grades."
    }));
    return;
  }

  const coursework = Number(student.coursework) || 0;
  const exam = Number(student.exam) || 0;
  const total = calculateTotal(student);
  const tuitionRecord = canViewFinance
    ? ManningFinance.getRecord(ledger, student.id)
    : null;
  const groups = [
    { title: "Profile", values: [
      ["Student ID", student.id],
      ["Name", student.name],
      ["Form", student.form],
      ["Subject", student.subject || "Not assigned"]
    ] },
    { title: "Grades", values: [
      ["Coursework", `${coursework} / 100`],
      ["Final exam", `${exam} / 100`],
      ["Weighted total", `${total}% (${gradeFor(total)})`],
      ["Result", total >= 50 ? "PASS" : "FAIL"]
    ] }
  ];
  if (canViewFinance) {
    const paid = ManningFinance.totalPaid(tuitionRecord);
    const balance = ManningFinance.roundMoney(tuitionRecord.tuitionTotal - paid);
    groups.push({ title: "Tuition Statement", values: [
      ["Tuition", ManningFinance.money(tuitionRecord.tuitionTotal)],
      ["Paid", ManningFinance.money(paid)],
      ["Balance", ManningFinance.money(balance)],
      ["Payment status", ManningFinance.status(tuitionRecord)]
    ] });
  }

  const fragment = document.createDocumentFragment();
  groups.forEach(({ title, values }) => {
    const section = document.createElement("section");
    section.className = "statement-section";
    const heading = document.createElement("h3");
    heading.textContent = title;
    section.appendChild(heading);
    values.forEach(([label, value]) => addLine(section, label, value));
    fragment.appendChild(section);
  });

  if (tuitionRecord && tuitionRecord.payments.length > 0) {
    const paymentsSection = document.createElement("section");
    paymentsSection.className = "statement-section";
    const heading = document.createElement("h3");
    heading.textContent = "Payment History";
    paymentsSection.appendChild(heading);
    tuitionRecord.payments.slice()
      .sort((first, second) => second.date.localeCompare(first.date))
      .forEach((payment) => {
        addLine(
          paymentsSection,
          payment.date,
          `${ManningFinance.money(payment.amount)} (${payment.method})`
        );
      });
    fragment.appendChild(paymentsSection);
  }
  statement.replaceChildren(fragment);
}

function renderReport() {
  // Filter the shared roster by form and calculate class-level counts, average and pass rate.
  const matches = students.filter((student) =>
    reportForm.value === "All" || student.form === reportForm.value
  );
  if (matches.length === 0) {
    reportStats.replaceChildren();
    showEmptyRow(reportBody, 7, "No students to show for this form.");
    return;
  }

  let totalScore = 0;
  let passCount = 0;
  const rows = matches.map((student) => {
    const total = calculateTotal(student);
    const result = total >= 50 ? "PASS" : "FAIL";
    totalScore += total;
    if (result === "PASS") passCount += 1;
    const row = document.createElement("tr");
    [student.id, student.name, student.form, student.subject || "Not assigned", total.toFixed(1), gradeFor(total), result]
      .forEach((value) => addCell(row, value));
    return row;
  });
  reportBody.replaceChildren(...rows);

  const values = [
    [String(matches.length), "Students"],
    [(totalScore / matches.length).toFixed(1), "Average total"],
    [`${Math.round((passCount / matches.length) * 100)}%`, "Pass rate"]
  ];
  const cards = values.map(([value, label]) => {
    const card = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = value;
    card.append(strong, document.createTextNode(label));
    return card;
  });
  reportStats.replaceChildren(...cards);
}

function populateViewer() {
  studentPick.replaceChildren(new Option("Choose a student", ""));
  students.forEach((student) => {
    studentPick.add(new Option(`${student.id} - ${student.name}`, student.id));
  });

  reportForm.replaceChildren(new Option("All forms", "All"));
  [...new Set(students.map((student) => student.form))]
    .sort()
    .forEach((form) => reportForm.add(new Option(form, form)));
  renderReport();
}

// Finance data is loaded only for accounts with finance management permission.
if (ManningAuth.stateError) {
  viewerMessage.textContent = `Account data error: ${ManningAuth.stateError}`;
} else if (ManningAuth.requirePermission("viewer:view")) {
  const session = ManningAuth.getSession();
  canViewFinance = ManningAuth.hasPermission("finance:manage");
  document.getElementById("signed-in-user").textContent = `${session.name} (${session.role})`;
  document.getElementById("dashboard-link").hidden = !ManningAuth.hasPermission("dashboard:view");
  document.getElementById("ledger-link").hidden = !ManningAuth.hasPermission("finance:manage");
  document.getElementById("search-link").hidden = !ManningAuth.hasPermission("finance:manage");

  try {
    students = ManningFinance.readStudents();
    if (canViewFinance) ledger = ManningFinance.readLedger();
    populateViewer();
  } catch (error) {
    viewerMessage.textContent = `Unable to load records: ${error.message}`;
    studentPick.disabled = true;
    reportForm.disabled = true;
    showEmptyRow(reportBody, 7, "Reports are unavailable until the saved records are corrected.");
  }

  studentPick.addEventListener("change", renderStatement);
  reportForm.addEventListener("change", renderReport);
}

logoutButton.addEventListener("click", () => {
  try {
    ManningAuth.signOut();
    location.replace("index.html");
  } catch (error) {
    viewerMessage.textContent = `Unable to sign out: ${error.message}`;
  }
});
