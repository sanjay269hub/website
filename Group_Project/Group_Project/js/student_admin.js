"use strict";

const STUDENTS_STORAGE_KEY = "manning_students";
const SUBJECT_CATALOG = {
  "Form 1": ["Integrated Science", "General Mathematics", "English Language"],
  "Form 2": ["Mathematics", "Information Technology", "English Literature"],
  "Form 3": ["Physics", "Chemistry", "Maths"]
};
// Form controls are cached once; the current roster is kept in memory during edits.
const adminMessage = document.getElementById("admin-message");
const studentForm = document.getElementById("student-record-form");
const nameInput = document.getElementById("student-name");
const emailInput = document.getElementById("student-email");
const ageInput = document.getElementById("student-age");
const formInput = document.getElementById("student-form");
const subjectInput = document.getElementById("student-subject");
const tableBody = document.getElementById("student-table-body");
const saveButton = document.getElementById("save-student");
const cancelButton = document.getElementById("cancel-edit");
const signedInUser = document.getElementById("signed-in-user");
const logoutButton = document.getElementById("logout-button");
let students = [];
let editingStudentId = null;

function showMessage(message) {
  adminMessage.textContent = message;
}

function readStudents() {
  // Validate persisted records before using them to build or update the admin table.
  const storedStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
  const records = storedStudents === null ? [] : JSON.parse(storedStudents);
  const ids = new Set();
  if (!Array.isArray(records) || records.some((student) => {
    if (!student ||
        typeof student.id !== "string" ||
        typeof student.name !== "string" ||
        typeof student.form !== "string" ||
        typeof student.subject !== "string" ||
        ids.has(student.id)) {
      return true;
    }
    ids.add(student.id);
    return false;
  })) {
    throw new Error("Saved student records have an invalid format.");
  }
  return records;
}

function saveStudents(nextStudents) {
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(nextStudents));
  students = nextStudents;
}

function nextStudentId() {
  // Generate the next MHS ID from the largest existing numeric suffix.
  const highestId = students.reduce((highest, student) => {
    const match = /^MHS(\d+)$/.exec(student.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 100);
  return `MHS${highestId + 1}`;
}

function setSubjects(selectedSubject = "") {
  const subjects = SUBJECT_CATALOG[formInput.value] || [];
  subjectInput.replaceChildren(new Option(
    subjects.length ? "Choose a subject" : "Choose a form first",
    ""
  ));
  subjects.forEach((subject) => {
    subjectInput.add(new Option(subject, subject));
  });
  subjectInput.disabled = subjects.length === 0;
  if (subjects.includes(selectedSubject)) subjectInput.value = selectedSubject;
}

function resetForm() {
  studentForm.reset();
  editingStudentId = null;
  setSubjects();
  saveButton.textContent = "Add Student";
  cancelButton.hidden = true;
}

function makeCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function createActionButton(label, action, studentId, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `student-action ${className}`.trim();
  button.dataset.action = action;
  button.dataset.studentId = studentId;
  button.textContent = label;
  return button;
}

function renderStudents() {
  // Rebuild rows with text nodes and explicit action data instead of injecting HTML.
  if (students.length === 0) {
    const row = document.createElement("tr");
    const cell = makeCell("No students registered.");
    cell.colSpan = 7;
    cell.className = "empty-state";
    row.appendChild(cell);
    tableBody.replaceChildren(row);
    return;
  }

  const rows = students.map((student) => {
    const row = document.createElement("tr");
    [
      student.id,
      student.name,
      student.email || "—",
      student.age === undefined || student.age === "" ? "—" : String(student.age),
      student.form,
      student.subject
    ].forEach((value) => row.appendChild(makeCell(value)));

    const actions = document.createElement("td");
    actions.append(
      createActionButton("Edit", "edit", student.id),
      createActionButton("Delete", "delete", student.id, "delete")
    );
    row.appendChild(actions);
    return row;
  });
  tableBody.replaceChildren(...rows);
}

function startEditing(student) {
  editingStudentId = student.id;
  nameInput.value = student.name;
  emailInput.value = student.email || "";
  ageInput.value = student.age === undefined ? "" : String(student.age);
  formInput.value = student.form;
  setSubjects(student.subject);
  saveButton.textContent = "Save Changes";
  cancelButton.hidden = false;
  nameInput.focus();
}

function handleSubmit(event) {
  // Validate form-specific fields, preserve grades on edit, then persist the shared roster.
  event.preventDefault();
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const age = Number(ageInput.value);
  const form = formInput.value;
  const subject = subjectInput.value;

  if (!name || !email || !Number.isInteger(age) || age < 5 || age > 100 ||
      !SUBJECT_CATALOG[form]?.includes(subject)) {
    showMessage("Enter a valid name, email, age, form, and subject.");
    return;
  }

  const duplicateEmail = students.some((student) =>
    student.id !== editingStudentId &&
    typeof student.email === "string" &&
    student.email.toLocaleLowerCase() === email.toLocaleLowerCase()
  );
  if (duplicateEmail) {
    showMessage("That email address is already assigned to another student.");
    emailInput.focus();
    return;
  }

  const existingStudent = students.find((student) => student.id === editingStudentId);
  const updatedStudent = {
    ...(existingStudent || {}),
    id: editingStudentId || nextStudentId(),
    name,
    email,
    age,
    form,
    subject,
    coursework: Number(existingStudent?.coursework) || 0,
    exam: Number(existingStudent?.exam) || 0
  };
  const nextStudents = existingStudent
    ? students.map((student) => student.id === editingStudentId ? updatedStudent : student)
    : [...students, updatedStudent];

  try {
    saveStudents(nextStudents);
    showMessage(existingStudent
      ? `${name}'s record was updated.`
      : `${name} was added with student ID ${updatedStudent.id}.`);
    resetForm();
    renderStudents();
  } catch (error) {
    showMessage(`Unable to save student records: ${error.message}`);
  }
}

function handleTableAction(event) {
  // One delegated handler serves Edit/Delete buttons added during each render.
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const student = students.find((record) => record.id === button.dataset.studentId);
  if (!student) return;

  if (button.dataset.action === "edit") {
    startEditing(student);
    showMessage(`Editing ${student.name}.`);
    return;
  }
  if (button.dataset.action !== "delete" ||
      !window.confirm(`Delete ${student.name} (${student.id}) from the student roster?`)) {
    return;
  }

  try {
    saveStudents(students.filter((record) => record.id !== student.id));
    if (editingStudentId === student.id) resetForm();
    showMessage(`${student.name} was removed from the roster.`);
    renderStudents();
  } catch (error) {
    showMessage(`Unable to delete student: ${error.message}`);
  }
}

// Do not initialize student controls unless this session has the registry permission.
if (ManningAuth.stateError) {
  showMessage(`Account data error: ${ManningAuth.stateError}`);
  studentForm.querySelectorAll("input, select, button").forEach((control) => {
    control.disabled = true;
  });
} else if (ManningAuth.requirePermission("students:manage")) {
  const session = ManningAuth.getSession();
  signedInUser.textContent = `${session.name} (${session.role})`;
  try {
    students = readStudents();
    renderStudents();
  } catch (error) {
    showMessage(`Unable to load student records: ${error.message}`);
    studentForm.querySelectorAll("input, select, button").forEach((control) => {
      control.disabled = true;
    });
  }

  formInput.addEventListener("change", () => setSubjects());
  studentForm.addEventListener("submit", handleSubmit);
  tableBody.addEventListener("click", handleTableAction);
  cancelButton.addEventListener("click", resetForm);
}

logoutButton.addEventListener("click", () => {
  try {
    ManningAuth.signOut();
    location.replace("index.html");
  } catch (error) {
    showMessage(`Unable to sign out: ${error.message}`);
  }
});
