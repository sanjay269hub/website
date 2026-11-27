/*
  Group Members:
  Aundre Chambers - 2303820
  Tishauna Dawes - 2307076
  Indera Mills - 2307650
  Sanjay Finley - 2007397
*/

"use strict";

const STUDENTS_STORAGE_KEY = "manning_students";

// Subject choices constrain the second filter and match the registry's form catalog.
const subjectCatalog = {
  "Form 1": ["Integrated Science", "General Mathematics", "English Language"],
  "Form 2": ["Mathematics", "Information Technology", "English Literature"],
  "Form 3": ["Physics", "Chemistry", "Maths"]
};

document.addEventListener("DOMContentLoaded", () => {
  // Resolve page controls after markup is ready, then stop safely if the dashboard is incomplete.
  const formSelect = document.getElementById("classSelect");
  const subjectSelect = document.getElementById("subjectSelect");
  const rosterBody = document.getElementById("studentTableBody");
  const gradeBody = document.getElementById("gradesTableBody");
  const subjectLabel = document.getElementById("selected-subject-label");
  const statusMessage = document.getElementById("statusMessage");
  const saveButton = document.getElementById("saveGradesBtn");
  const metricsContainer = document.getElementById("classMetricsContainer");
  const reportContainer = document.getElementById("reportCardContainer");
  const gradeForm = document.getElementById("gradeEntryForm");

  if (!formSelect || !subjectSelect || !rosterBody || !gradeBody || !subjectLabel ||
      !statusMessage || !saveButton || !metricsContainer || !reportContainer || !gradeForm) {
    return;
  }

  if (!window.ManningAuth || ManningAuth.stateError ||
      !ManningAuth.hasPermission("grades:edit")) {
    formSelect.disabled = true;
    subjectSelect.disabled = true;
    saveButton.disabled = true;
    return;
  }

  function showMessage(message) {
    statusMessage.textContent = message;
  }

  function showTableMessage(body, columnCount, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columnCount;
    cell.className = "empty-state";
    cell.textContent = message;
    row.appendChild(cell);
    body.replaceChildren(row);
  }

  function loadStudents() {
    // Grade entry reads the admin-managed roster directly so roster deletions remain deleted.
    const storedStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
    const students = storedStudents === null ? [] : JSON.parse(storedStudents);
    const studentIds = new Set();
    if (!Array.isArray(students) || students.some((student) => {
      if (!student ||
          typeof student.id !== "string" ||
          typeof student.name !== "string" ||
          typeof student.form !== "string" ||
          typeof student.subject !== "string" ||
          studentIds.has(student.id)) {
        return true;
      }
      studentIds.add(student.id);
      return false;
    })) {
      throw new Error("Stored student records have an invalid format.");
    }

    const allStudents = students.map((student) => ({
      ...student,
      coursework: Number.isFinite(Number(student.coursework)) ? Number(student.coursework) : 0,
      exam: Number.isFinite(Number(student.exam)) ? Number(student.exam) : 0
    }));
    return allStudents;
  }

  let students;
  try {
    students = loadStudents();
  } catch (error) {
    showMessage(`Unable to load student records: ${error.message}`);
    formSelect.disabled = true;
    subjectSelect.disabled = true;
    saveButton.disabled = true;
    showTableMessage(rosterBody, 5, "Student records could not be loaded.");
    showTableMessage(gradeBody, 7, "Student records could not be loaded.");
    return;
  }

  function gradeFor(total) {
    if (total >= 80) return "A";
    if (total >= 65) return "B";
    if (total >= 50) return "C";
    return "F";
  }

  function statusFor(total) {
    return total >= 50 ? "PASS" : "FAIL";
  }

  function calculateTotal(coursework, exam) {
    return Number(((coursework * 0.4) + (exam * 0.6)).toFixed(1));
  }

  function renderMetrics(studentsForMetrics) {
    // Summarize the currently filtered subject, including unsaved edits while typing.
    if (studentsForMetrics.length === 0) {
      metricsContainer.replaceChildren(Object.assign(document.createElement("p"), {
        textContent: "No grades available for this subject."
      }));
      return;
    }

    const totals = studentsForMetrics.map((student) =>
      calculateTotal(Number(student.coursework), Number(student.exam))
    );
    const average = totals.reduce((sum, total) => sum + total, 0) / totals.length;
    const passCount = totals.filter((total) => total >= 50).length;
    const failCount = totals.length - passCount;
    const list = document.createElement("ul");
    [
      `Class Average: ${average.toFixed(1)}%`,
      `Highest Score: ${Math.max(...totals).toFixed(1)}%`,
      `Lowest Score: ${Math.min(...totals).toFixed(1)}%`,
      `Pass / Fail Breakdown: ${passCount} Passed | ${failCount} Failed`
    ].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      list.appendChild(item);
    });
    metricsContainer.replaceChildren(list);
  }

  function renderReportCard(student) {
    // Build the selected student's report as DOM text nodes using current grade inputs.
    const coursework = Number(student.coursework);
    const exam = Number(student.exam);
    const total = calculateTotal(coursework, exam);
    const grade = gradeFor(total);
    const status = statusFor(total);

    const heading = document.createElement("h3");
    heading.textContent = "Manning's High School Report Card";
    const details = [
      ["Student Name:", `${student.name} (${student.id})`],
      ["Grade Level:", student.form],
      ["Subject:", student.subject]
    ];
    const resultDetails = [
      ["Coursework:", `${coursework} / 100`],
      ["Final Exam:", `${exam} / 100`],
      ["Final Weighted Average:", `${total}%`],
      ["Awarded Grade:", `${grade} (${status})`]
    ];

    const fragment = document.createDocumentFragment();
    fragment.appendChild(heading);
    fragment.appendChild(document.createElement("hr"));
    details.forEach(([label, value]) => {
      const paragraph = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = label;
      paragraph.append(strong, ` ${value}`);
      fragment.appendChild(paragraph);
    });
    fragment.appendChild(document.createElement("hr"));
    resultDetails.forEach(([label, value]) => {
      const paragraph = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = label;
      paragraph.append(strong, ` ${value}`);
      fragment.appendChild(paragraph);
    });
    reportContainer.replaceChildren(fragment);
  }

  function resetReportPreview() {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Click \"View Report\" beside any student in the table to generate their report card.";
    reportContainer.replaceChildren(paragraph);
  }

  function renderSelection() {
    // Keep roster, grade table, metrics and preview synchronized with both filter values.
    const selectedForm = formSelect.value;
    const selectedSubject = subjectSelect.value;
    const hasSelection = Boolean(selectedForm && selectedSubject);
    saveButton.disabled = !hasSelection;

    if (!hasSelection) {
      subjectLabel.textContent = "None Selected";
      showTableMessage(rosterBody, 5, "Please select a Form and Subject above to display students.");
      showTableMessage(gradeBody, 7, "Select a class and subject above to load student records.");
      metricsContainer.replaceChildren(Object.assign(document.createElement("p"), {
        textContent: "No subject selected."
      }));
      reportContainer.replaceChildren(Object.assign(document.createElement("p"), {
        textContent: "Click \"View Report\" beside any student in the table to generate their report card."
      }));
      return;
    }

    subjectLabel.textContent = `${selectedForm} - ${selectedSubject}`;
    const matchingStudents = students.filter((student) =>
      student.form === selectedForm && student.subject === selectedSubject
    );

    if (matchingStudents.length === 0) {
      showTableMessage(rosterBody, 5, "No students currently registered under this subject.");
      showTableMessage(gradeBody, 7, "No students currently registered under this subject.");
      metricsContainer.replaceChildren(Object.assign(document.createElement("p"), {
        textContent: "No grades available for this subject."
      }));
      return;
    }

    const rosterRows = matchingStudents.map((student) => {
      const row = document.createElement("tr");
      [student.id, student.name, student.form, student.subject, "Enrolled"].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      return row;
    });
    rosterBody.replaceChildren(...rosterRows);

    const gradeRows = matchingStudents.map((student) => {
      const coursework = Number(student.coursework);
      const exam = Number(student.exam);
      const total = calculateTotal(coursework, exam);
      const row = document.createElement("tr");

      [student.id, student.name].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      [
        { value: coursework, assessment: "coursework", label: `${student.name} coursework mark` },
        { value: exam, assessment: "exam", label: `${student.name} final exam mark` }
      ].forEach(({ value, assessment, label }) => {
        const cell = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "100";
        input.step = "0.1";
        input.value = String(value);
        input.setAttribute("aria-label", label);
        input.dataset.studentId = student.id;
        input.dataset.assessment = assessment;
        cell.appendChild(input);
        row.appendChild(cell);
      });

      const totalCell = document.createElement("td");
      totalCell.className = "weighted-total";
      totalCell.textContent = total.toFixed(1);
      row.appendChild(totalCell);

      const gradeCell = document.createElement("td");
      gradeCell.className = "letter-grade";
      gradeCell.textContent = gradeFor(total);
      row.appendChild(gradeCell);

      const actionCell = document.createElement("td");
      const reportButton = document.createElement("button");
      reportButton.type = "button";
      reportButton.className = "view-report-btn";
      reportButton.dataset.studentId = student.id;
      reportButton.textContent = "View Report";
      actionCell.appendChild(reportButton);
      row.appendChild(actionCell);
      return row;
    });
    gradeBody.replaceChildren(...gradeRows);
    renderMetrics(matchingStudents);
  }

  gradeBody.addEventListener("input", (event) => {
    // Update weighted results and draft metrics immediately without saving yet.
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.studentId) return;

    const row = input.closest("tr");
    const coursework = Number(row.querySelector('[data-assessment="coursework"]').value);
    const exam = Number(row.querySelector('[data-assessment="exam"]').value);
    const total = calculateTotal(coursework, exam);
    row.querySelector(".weighted-total").textContent = total.toFixed(1);
    row.querySelector(".letter-grade").textContent = gradeFor(total);

    const draftStudents = Array.from(gradeBody.querySelectorAll("tr")).map((gradeRow) => {
      const studentId = gradeRow.querySelector("[data-student-id]")?.dataset.studentId;
      const student = students.find((record) => record.id === studentId);
      if (!student) return null;
      return {
        ...student,
        coursework: Number(gradeRow.querySelector('[data-assessment="coursework"]')?.value) || 0,
        exam: Number(gradeRow.querySelector('[data-assessment="exam"]')?.value) || 0
      };
    }).filter(Boolean);
    renderMetrics(draftStudents);
  });

  gradeBody.addEventListener("click", (event) => {
    const button = event.target.closest(".view-report-btn");
    if (!button) return;
    const student = students.find((record) => record.id === button.dataset.studentId);
    if (!student) return;

    const row = button.closest("tr");
    const courseworkInput = row.querySelector('[data-assessment="coursework"]');
    const examInput = row.querySelector('[data-assessment="exam"]');
    renderReportCard({
      ...student,
      coursework: Number(courseworkInput.value),
      exam: Number(examInput.value)
    });
  });

  gradeForm.addEventListener("invalid", (event) => {
    event.preventDefault();
    showMessage("Enter coursework and exam marks from 0 to 100 before saving.");
  }, true);

  gradeForm.addEventListener("submit", (event) => {
    // Validate every mark before committing any changes to shared localStorage.
    event.preventDefault();
    const inputs = Array.from(gradeBody.querySelectorAll("input[data-student-id]"));
    if (inputs.some((input) => !input.validity.valid || input.value === "")) {
      showMessage("Enter coursework and exam marks from 0 to 100 before saving.");
      return;
    }

    inputs.forEach((input) => {
      const student = students.find((record) => record.id === input.dataset.studentId);
      student[input.dataset.assessment] = Number(input.value);
    });

    try {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
      showMessage("Sample grades saved in this browser.");
      renderSelection();
    } catch (error) {
      showMessage(`Unable to save grades: ${error.message}`);
    }
  });

  formSelect.addEventListener("change", () => {
    const subjects = subjectCatalog[formSelect.value] || [];
    subjectSelect.replaceChildren(new Option("-- Choose Subject --", ""));
    subjects.forEach((subject) => {
      subjectSelect.add(new Option(subject, subject));
    });
    subjectSelect.disabled = subjects.length === 0;
    showMessage("");
    resetReportPreview();
    renderSelection();
  });

  subjectSelect.addEventListener("change", () => {
    showMessage("");
    resetReportPreview();
    renderSelection();
  });
});
