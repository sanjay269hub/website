"use strict";

(() => {
  // Shared storage and validation helpers keep ledger, search and viewer calculations consistent.
  const STUDENTS_KEY = "manning_students";
  const LEDGER_KEY = "manning_financial_ledger";
  const PAYMENT_METHODS = ["Cash", "Card", "Bank transfer"];

  function readStudents() {
    // Finance screens always use the student manager's canonical roster.
    const stored = localStorage.getItem(STUDENTS_KEY);
    const students = stored === null ? [] : JSON.parse(stored);
    const ids = new Set();
    if (!Array.isArray(students) || students.some((student) => {
      if (!student ||
          typeof student.id !== "string" ||
          typeof student.name !== "string" ||
          typeof student.form !== "string" ||
          ids.has(student.id)) {
        return true;
      }
      ids.add(student.id);
      return false;
    })) {
      throw new Error("The shared student roster has an invalid format.");
    }
    return students;
  }

  function readLedger() {
    // One account per student; reject malformed payments before displaying totals.
    const stored = localStorage.getItem(LEDGER_KEY);
    const records = stored === null ? [] : JSON.parse(stored);
    const studentIds = new Set();
    if (!Array.isArray(records) || records.some((record) => {
      if (!record ||
          typeof record.studentId !== "string" ||
          studentIds.has(record.studentId) ||
          !Number.isFinite(record.tuitionTotal) ||
          record.tuitionTotal < 0 ||
          !Array.isArray(record.payments)) {
        return true;
      }
      studentIds.add(record.studentId);
      return record.payments.some((payment) =>
        !payment ||
        typeof payment.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payment.date) ||
        !Number.isFinite(payment.amount) ||
        payment.amount <= 0 ||
        !PAYMENT_METHODS.includes(payment.method)
      );
    })) {
      throw new Error("Saved financial ledger data has an invalid format.");
    }
    return records;
  }

  function saveLedger(records) {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(records));
  }

  function getRecord(records, studentId) {
    return records.find((record) => record.studentId === studentId) ||
      { studentId, tuitionTotal: 0, payments: [] };
  }

  function totalPaid(record) {
    return roundMoney(record.payments.reduce((total, payment) => total + payment.amount, 0));
  }

  function roundMoney(amount) {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  function status(record) {
    // Status is calculated from current tuition and payments instead of stored separately.
    const balance = roundMoney(record.tuitionTotal - totalPaid(record));
    if (record.tuitionTotal > 0 && balance <= 0) return "Paid";
    if (record.payments.length > 0) return "Pending";
    return "Outstanding";
  }

  function money(amount) {
    return new Intl.NumberFormat("en-JM", {
      style: "currency",
      currency: "JMD",
      minimumFractionDigits: 2
    }).format(amount);
  }

  window.ManningFinance = Object.freeze({
    paymentMethods: PAYMENT_METHODS,
    readStudents,
    readLedger,
    saveLedger,
    getRecord,
    roundMoney,
    totalPaid,
    status,
    money
  });
})();
