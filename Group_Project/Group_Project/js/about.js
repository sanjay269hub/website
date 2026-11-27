const directoryTable = document.getElementById("directory-table");
const searchBox = document.getElementById("search-box");

if (directoryTable && searchBox) {
  // Seed the directory once; subsequent visits use the browser-stored directory data.
  const defaultTeachers = [
    { name: "Mr. Simon Green", subject: "Spanish" },
    { name: "Mrs. Selena Mitchell", subject: "English Literature" },
    { name: "Mr. Dane Williams", subject: "Integrated Science" },
    { name: "Ms. Veronica Lynch", subject: "Mathematics" },
    { name: "Mr. Damion Thomas", subject: "Maths" },
    { name: "Ms. Sasha Myers", subject: "Principles of Business" },
    { name: "Mr. Mike Thompson", subject: "Biology" },
    { name: "Mrs. Simone Brown", subject: "Physics" }
  ];

  let teachers;
  try {
    const storedTeachers = localStorage.getItem("teachers");
    teachers = storedTeachers === null ? defaultTeachers : JSON.parse(storedTeachers);
    if (!Array.isArray(teachers) || teachers.some((teacher) =>
      !teacher ||
      typeof teacher.name !== "string" ||
      typeof teacher.subject !== "string"
    )) {
      throw new Error("Stored teacher records have an invalid format.");
    }
    if (storedTeachers === null) {
      localStorage.setItem("teachers", JSON.stringify(teachers));
    }
  } catch (error) {
    teachers = null;
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = `Unable to load the teacher directory: ${error.message}`;
    row.appendChild(cell);
    directoryTable.replaceChildren(row);
  }

  if (teachers) {
    // Build table cells as text so directory data is displayed as content, not markup.
    function showTeachers(list) {
      if (list.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 2;
        cell.textContent = "No teachers found.";
        row.appendChild(cell);
        directoryTable.replaceChildren(row);
        return;
      }

      const rows = list.map((teacher) => {
        const row = document.createElement("tr");
        const name = document.createElement("td");
        const subject = document.createElement("td");
        name.textContent = teacher.name;
        subject.textContent = teacher.subject;
        row.append(name, subject);
        return row;
      });
      directoryTable.replaceChildren(...rows);
    }

    // Filter the in-memory list as the user types, matching names and subjects.
    searchBox.addEventListener("input", () => {
      const query = searchBox.value.trim().toLocaleLowerCase();
      const filteredTeachers = teachers.filter((teacher) =>
        teacher.name.toLocaleLowerCase().includes(query) ||
        teacher.subject.toLocaleLowerCase().includes(query)
      );
      showTeachers(filteredTeachers);
    });

    showTeachers(teachers);
  }
}
