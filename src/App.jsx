import { useState, useEffect } from "react";
import {
  Users,
  Calendar,
  BarChart3,
  Plus,
  Check,
  X,
  Edit3,
  Trash2,
  Save,
  UserCheck,
  UserX,
  Clock,
  Menu,
} from "lucide-react";
import { ref, onValue, set, update, remove, get } from "firebase/database";
import { db } from "./firebase";

export default function App() {
  const [activeTab, setActiveTab] = useState("attendance");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Students + Attendance
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  // New/Edit Student form state
  const [newStudent, setNewStudent] = useState({
    name: "",
    rollNumber: "",
    email: "",
    phone: "",
  });

  // Class Settings
  const [classSettings, setClassSettings] = useState({
    departmentName: "Computer Science Engineering",
    teacher: "Dr. Suresh Kumar",
    semester: "Fifth Semester",
  });

  const classId = "class1";

  // Load data from Firebase
  useEffect(() => {
    const classRef = ref(db, `classes/${classId}`);
    const studentsRef = ref(db, `students/${classId}`);
    const attendanceRef = ref(db, `attendance/${classId}`);

    const unsubscribeClass = onValue(classRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setClassSettings((prev) => ({ ...prev, ...data }));
    });

    const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        arr.sort((a, b) => {
          const ra = a.rollNumber || "";
          const rb = b.rollNumber || "";
          return (
            ra.localeCompare(rb, undefined, { numeric: true }) ||
            (a.name || "").localeCompare(b.name || "")
          );
        });
        setStudents(arr);
      } else {
        setStudents([]);
      }
    });

    const unsubscribeAttendance = onValue(attendanceRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setAttendanceRecords([]);
        return;
      }

      const recordsArray = [];
      Object.keys(data).forEach((date) => {
        Object.keys(data[date]).forEach((studentId) => {
          recordsArray.push({
            id: `${date}_${studentId}`,
            studentId,
            date,
            status: data[date][studentId].status,
            remarks: data[date][studentId].remarks || "",
          });
        });
      });

      recordsArray.sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          a.studentId.localeCompare(b.studentId)
      );
      setAttendanceRecords(recordsArray);
    });

    return () => {
      unsubscribeClass();
      unsubscribeStudents();
      unsubscribeAttendance();
    };
  }, [classId]);

  // Helpers
  const getTodayAttendance = (studentId, date = selectedDate) =>
    attendanceRecords.find(
      (record) => record.studentId === studentId && record.date === date
    );

  const updateAttendanceStatus = async (studentId, status, remarks = "") => {
    try {
      await set(ref(db, `attendance/${classId}/${selectedDate}/${studentId}`), {
        status,
        remarks,
      });
    } catch (e) {
      console.error("Error updating attendance:", e);
      setErrorMsg("Failed to update attendance!");
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.rollNumber) return;
    const newKey = `student_${Date.now()}`;
    try {
      await set(ref(db, `students/${classId}/${newKey}`), newStudent);
      setNewStudent({ name: "", rollNumber: "", email: "", phone: "" });
      setShowAddStudent(false);
    } catch (e) {
      console.error("Error adding student:", e);
      setErrorMsg("Failed to add student!");
    }
  };

  const handleDeleteStudent = async (id) => {
    try {
      await remove(ref(db, `students/${classId}/${id}`));
      const attRootRef = ref(db, `attendance/${classId}`);
      const snap = await get(attRootRef);
      const data = snap.val() || {};
      const updates = {};
      Object.keys(data).forEach((date) => {
        if (data[date] && data[date][id]) {
          updates[`attendance/${classId}/${date}/${id}`] = null;
        }
      });
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
    } catch (e) {
      console.error("Error deleting student:", e);
      setErrorMsg("Failed to delete student!");
    }
  };

  const handleSaveStudent = async () => {
    if (editingStudent) {
      try {
        await update(
          ref(db, `students/${classId}/${editingStudent.id}`),
          newStudent
        );
        setEditingStudent(null);
        setNewStudent({ name: "", rollNumber: "", email: "", phone: "" });
        setShowAddStudent(false);
      } catch (e) {
        console.error("Error updating student:", e);
        setErrorMsg("Failed to update student!");
      }
    } else {
      handleAddStudent();
    }
  };

  const getAttendanceStats = (studentId) => {
    const records = attendanceRecords.filter((r) => r.studentId === studentId);
    const totalDays = records.length;
    const presentDays = records.filter((r) => r.status === "present").length;
    const lateDays = records.filter((r) => r.status === "late").length;
    const absentDays = records.filter((r) => r.status === "absent").length;
    return {
      totalDays,
      presentDays,
      lateDays,
      absentDays,
      attendancePercentage:
        totalDays > 0
          ? Math.round(((presentDays + lateDays) / totalDays) * 100)
          : 0,
    };
  };

  const getClassStats = () => {
    const todayRecords = attendanceRecords.filter(
      (r) => r.date === selectedDate
    );
    const totalStudents = students.length;
    const presentCount = todayRecords.filter((r) => r.status === "present").length;
    const lateCount = todayRecords.filter((r) => r.status === "late").length;
    const absentCount = todayRecords.filter((r) => r.status === "absent").length;
    const notMarked = totalStudents - todayRecords.length;
    return {
      totalStudents,
      presentCount,
      lateCount,
      absentCount,
      notMarked,
      attendancePercentage:
        totalStudents > 0
          ? Math.round(((presentCount + lateCount) / totalStudents) * 100)
          : 0,
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800";
      case "absent":
        return "bg-red-100 text-red-800";
      case "late":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "present":
        return <Check className="w-4 h-4" />;
      case "absent":
        return <X className="w-4 h-4" />;
      case "late":
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const classStats = getClassStats();

  const NavButton = ({ id, label, Icon }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setMobileMenuOpen(false);
      }}
      className={`flex items-center px-4 py-2 rounded-lg transition-all duration-150 text-sm md:text-base font-medium ${
        activeTab === id
          ? "bg-white text-slate-800 shadow"
          : "text-white hover:bg-white/10"
      }`}
      aria-pressed={activeTab === id}
    >
      <Icon className="w-4 h-4 mr-2" />
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden">{label.split(" ")[0]}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-900 via-violet-900 to-indigo-900 py-6">
      {/* 🔥 Error Toast */}
      {errorMsg && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {errorMsg}
          <button
            className="ml-2 text-sm underline"
            onClick={() => setErrorMsg("")}
          >
            Close
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="max-w-7xl mx-auto px-4 mb-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {classSettings.departmentName}
              </h1>
              <div className="text-slate-300 text-sm md:text-base space-y-1">
                <p>Faculty: {classSettings.teacher}</p>
                <p>Semester: {classSettings.semester}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30"
              />
            </div>
          </div>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav className="max-w-7xl mx-auto px-4 mb-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 shadow-lg">
          <div className="flex md:hidden justify-between items-center px-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white p-2"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-white font-medium">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </span>
          </div>
          <div
            className={`${
              mobileMenuOpen ? "flex" : "hidden"
            } md:flex flex-col md:flex-row gap-2 md:gap-4 mt-2 md:mt-0`}
          >
            <NavButton id="attendance" label="Attendance" Icon={Calendar} />
            <NavButton id="students" label="Students" Icon={Users} />
            <NavButton id="reports" label="Reports" Icon={BarChart3} />
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4">
        {/* ATTENDANCE TAB */}
        {activeTab === "attendance" && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-lg text-white">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2" /> Attendance for {selectedDate}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const todayAttendance = getTodayAttendance(student.id);
                    return (
                      <tr
                        key={student.id}
                        className="border-b border-white/10 hover:bg-white/5"
                      >
                        <td className="px-4 py-3">{student.rollNumber}</td>
                        <td className="px-4 py-3">{student.name}</td>
                        <td className="px-4 py-3">
                          {todayAttendance ? (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${getStatusColor(
                                todayAttendance.status
                              )}`}
                            >
                              {getStatusIcon(todayAttendance.status)}
                              {todayAttendance.status}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-sm">
                              Not Marked
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                updateAttendanceStatus(student.id, "present")
                              }
                              className="p-2 bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                              title="Mark Present"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                updateAttendanceStatus(student.id, "absent")
                              }
                              className="p-2 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                              title="Mark Absent"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                updateAttendanceStatus(student.id, "late")
                              }
                              className="p-2 bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors"
                              title="Mark Late"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-300">
                        No students found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === "students" && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-lg text-white">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <Users className="w-5 h-5 mr-2" /> Students
              </h2>
              <button
                onClick={() => setShowAddStudent(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Student
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3 hidden md:table-cell">Email</th>
                    <th className="px-4 py-3 hidden md:table-cell">Phone</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-white/10 hover:bg-white/5"
                    >
                      <td className="px-4 py-3">{student.rollNumber}</td>
                      <td className="px-4 py-3">{student.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {student.email || "-"}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {student.phone || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingStudent(student);
                              setNewStudent(student);
                              setShowAddStudent(true);
                            }}
                            className="p-2 bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
                            title="Edit Student"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="p-2 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                            title="Delete Student"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-300">
                        No students found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ADD/EDIT STUDENT FORM */}
            {showAddStudent && (
              <div className="mt-6 bg-white/10 p-6 rounded-xl border border-white/20">
                <h3 className="text-lg font-medium mb-4">
                  {editingStudent ? "Edit Student" : "Add New Student"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newStudent.name}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, name: e.target.value })
                    }
                    className="px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30"
                  />
                  <input
                    type="text"
                    placeholder="Roll Number"
                    value={newStudent.rollNumber}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        rollNumber: e.target.value,
                      })
                    }
                    className="px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newStudent.email}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, email: e.target.value })
                    }
                    className="px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={newStudent.phone}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, phone: e.target.value })
                    }
                    className="px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30"
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSaveStudent}
                    className="flex items-center px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" /> Save
                  </button>
                  <button
                    onClick={() => {
                      setShowAddStudent(false);
                      setEditingStudent(null);
                      setNewStudent({
                        name: "",
                        rollNumber: "",
                        email: "",
                        phone: "",
                      });
                    }}
                    className="px-4 py-2 bg-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === "reports" && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-lg text-white">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" /> Reports
            </h2>
            {/* CLASS STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/10 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold">{classStats.totalStudents}</div>
                <div className="text-sm text-slate-300">Total Students</div>
              </div>
              <div className="bg-green-500/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold">
                  {classStats.presentCount}
                </div>
                <div className="text-sm">Present Today</div>
              </div>
              <div className="bg-yellow-500/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold">{classStats.lateCount}</div>
                <div className="text-sm">Late Today</div>
              </div>
              <div className="bg-red-500/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold">
                  {classStats.absentCount}
                </div>
                <div className="text-sm">Absent Today</div>
              </div>
            </div>

            {/* STUDENT REPORTS */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Present</th>
                    <th className="px-4 py-3">Late</th>
                    <th className="px-4 py-3">Absent</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const stats = getAttendanceStats(student.id);
                    return (
                      <tr
                        key={student.id}
                        className="border-b border-white/10 hover:bg-white/5"
                      >
                        <td className="px-4 py-3">{student.rollNumber}</td>
                        <td className="px-4 py-3">{student.name}</td>
                        <td className="px-4 py-3">{stats.presentDays}</td>
                        <td className="px-4 py-3">{stats.lateDays}</td>
                        <td className="px-4 py-3">{stats.absentDays}</td>
                        <td className="px-4 py-3">{stats.totalDays}</td>
                        <td className="px-4 py-3">
                          {stats.attendancePercentage}%
                        </td>
                      </tr>
                    );
                  })}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-300">
                        No students found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
