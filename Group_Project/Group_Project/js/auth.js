"use strict";

(() => {
  // Browser storage keys shared by login, roster, gradebook and finance modules.
  const USERS_KEY = "manning_users";
  const STUDENTS_KEY = "manning_students";
  const SESSION_KEY = "manning_session";
  // Fixed coursework demo accounts; browser-side credentials are not production authentication.
  const ACCOUNTS = [
    { username: "admin", password: "admin123", name: "School Administrator", role: "admin" },
    { username: "teacher", password: "teacher123", name: "Sample Teacher", role: "teacher" },
    { username: "viewer", password: "viewer123", name: "General Authorized User", role: "viewer" }
  ];
  const SAMPLE_STUDENTS = [
    { id: "MHS101", name: "Ashley Campbell", form: "Form 2", subject: "Mathematics", coursework: 86, exam: 82 },
    { id: "MHS102", name: "Bryan Dixon", form: "Form 2", subject: "Mathematics", coursework: 74, exam: 78 },
    { id: "MHS103", name: "Chloe Morgan", form: "Form 2", subject: "Information Technology", coursework: 91, exam: 88 },
    { id: "MHS104", name: "David Miller", form: "Form 1", subject: "Integrated Science", coursework: 68, exam: 72 },
    { id: "MHS105", name: "Emma Watson", form: "Form 3", subject: "Physics", coursework: 83, exam: 79 },
    { id: "MHS106", name: "Fiona Brown", form: "Form 1", subject: "General Mathematics", coursework: 77, exam: 81 },
    { id: "MHS107", name: "Gabriel Thomas", form: "Form 1", subject: "English Language", coursework: 88, exam: 84 },
    { id: "MHS108", name: "Hannah Clarke", form: "Form 1", subject: "Integrated Science", coursework: 72, exam: 76 },
    { id: "MHS109", name: "Isaac Williams", form: "Form 2", subject: "English Literature", coursework: 79, exam: 73 },
    { id: "MHS110", name: "Jade Thompson", form: "Form 2", subject: "Information Technology", coursework: 85, exam: 89 },
    { id: "MHS111", name: "Kieran Lewis", form: "Form 2", subject: "Mathematics", coursework: 69, exam: 75 },
    { id: "MHS112", name: "Leah Robinson", form: "Form 3", subject: "Chemistry", coursework: 81, exam: 77 },
    { id: "MHS113", name: "Malik Edwards", form: "Form 3", subject: "Maths", coursework: 90, exam: 86 },
    { id: "MHS114", name: "Naomi Grant", form: "Form 3", subject: "Physics", coursework: 76, exam: 82 }
  ];
  // Each protected page checks one of these capabilities before exposing its controls.
  const PERMISSIONS = {
    admin: ["dashboard:view", "grades:edit", "reports:view", "students:manage", "finance:manage", "viewer:view"],
    teacher: ["dashboard:view", "grades:edit", "reports:view"],
    viewer: ["viewer:view"]
  };

  function initializeState() {
    // Create demo profiles and a starter roster only when no saved version exists.
    const storedUsers = localStorage.getItem(USERS_KEY);
    if (storedUsers === null) {
      localStorage.setItem(USERS_KEY, JSON.stringify(accountProfiles()));
    } else {
      const users = JSON.parse(storedUsers);
      const hasValidProfiles = Array.isArray(users) && users.every((user) =>
        user &&
        typeof user.username === "string" &&
        typeof user.name === "string" &&
        typeof user.role === "string"
      );
      if (!hasValidProfiles) {
        throw new Error("Saved account data is invalid. Clear the manning_users entry to restore demo accounts.");
      }
      localStorage.setItem(USERS_KEY, JSON.stringify(accountProfiles()));
    }

    if (localStorage.getItem(STUDENTS_KEY) === null) {
      localStorage.setItem(STUDENTS_KEY, JSON.stringify(SAMPLE_STUDENTS));
    }
    migrateStudentRecords();
    localStorage.removeItem("manning_financial_statements");

    const storedSession = sessionStorage.getItem(SESSION_KEY);
    if (storedSession !== null) {
      let session;
      try {
        session = JSON.parse(storedSession);
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        session = null;
      }

      const validSession = session && ACCOUNTS.some((account) =>
        account.username === session?.username && account.role === session?.role
      );
      if (!validSession) sessionStorage.removeItem(SESSION_KEY);
    }
  }

  function migrateStudentRecords() {
    // Keep saved student records aligned with current form and subject names without losing grades.
    const storedStudents = localStorage.getItem(STUDENTS_KEY);
    if (storedStudents === null) return;

    const students = JSON.parse(storedStudents);
    if (!Array.isArray(students) || students.some((student) =>
      !student || typeof student !== "object" || typeof student.form !== "string"
    )) {
      throw new Error("Saved student records are invalid. Correct the manning_students entry before continuing.");
    }

    let changed = false;
    students.forEach((student) => {
      if (student.form === "Form 4") {
        student.form = "Form 2";
        changed = true;
      } else if (student.form === "Form 5") {
        student.form = "Form 3";
        changed = true;
      }
      if (student.subject === "Principles of Accounts") {
        student.subject = "Maths";
        changed = true;
      }
    });
    if (changed) localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
  }

  function accountProfiles() {
    return ACCOUNTS.map(({ username, name, role }) => ({ username, name, role }));
  }

  function getSession() {
    // Resolve the session against known accounts rather than trusting stored role details.
    const storedSession = sessionStorage.getItem(SESSION_KEY);
    if (storedSession === null) return null;

    const session = JSON.parse(storedSession);
    const account = ACCOUNTS.find((candidate) =>
      candidate.username === session?.username && candidate.role === session?.role
    );
    if (!account) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { username: account.username, name: account.name, role: account.role };
  }

  function signIn(username, password) {
    const account = ACCOUNTS.find((candidate) =>
      candidate.username === username.trim().toLowerCase() &&
      candidate.password === password
    );
    if (!account) return false;

    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      username: account.username,
      role: account.role
    }));
    return true;
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function hasPermission(permission) {
    const session = getSession();
    return Boolean(session && PERMISSIONS[session.role]?.includes(permission));
  }

  function requirePermission(permission) {
    // Send signed-out visitors to login and authenticated users without access to the dashboard.
    if (hasPermission(permission)) return true;
    const session = getSession();
    if (session) {
      location.replace(hasPermission("viewer:view") && !hasPermission("dashboard:view")
        ? "viewer.html"
        : "teacher_dashboard.html");
      return false;
    }
    const returnTo = `${location.pathname.split("/").pop()}${location.search}`;
    location.replace(`login.html?next=${encodeURIComponent(returnTo)}`);
    return false;
  }

  let stateError = "";
  try {
    initializeState();
  } catch (error) {
    stateError = error.message;
  }

  window.ManningAuth = Object.freeze({
    getSession,
    hasPermission,
    requirePermission,
    signOut,
    signIn,
    stateError
  });
})();
