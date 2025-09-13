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
  Menu
} from "lucide-react";
import { ref, onValue, set, update, remove, get, off } from "firebase/database";
import { db } from "./firebase";

// This component assumes TailwindCSS is configured in the project.
// Small CSS tweaks can be added in index.css for scrollbar or subtle shadows.

export default function App() {
  const [activeTab, setActiveTab] = useState("attendance");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Students + Attendance
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  // New/Edit Student form state
  const [newStudent, setNewStudent] = useState({ name: "", rollNumber: "", email: "", phone: "" });

  // Class Settings (loaded from DB but with defaults)
  const [classSettings, setClassSettings] = useState({
    departmentName: "Computer Science Engineering",
    teacher: "Dr. Suresh Kumar",
    semester: "Fifth Semester"
  });

  const classId = "class1"; // change if you want multiple classes

  // Load data from Firebase
  useEffect(() => {
    setLoading(true);

    const classRef = ref(db, `classes/${classId}`);
    const studentsRef = ref(db, `students/${classId}`);
    const attendanceRef = ref(db, `attendance/${classId}`);

    const classListener = onValue(classRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setClassSettings((prev) => ({ ...prev, ...data }));
    });

    const studentsListener = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        // Sort by rollNumber or name for consistent listing
        arr.sort((a, b) => {
          const ra = a.rollNumber || "";
          const rb = b.rollNumber || "";
          return ra.localeCompare(rb, undefined, { numeric: true }) || (a.name || "").localeCompare(b.name || "");
        });
        setStudents(arr);
      } else {
        setStudents([]);
      }
      setLoading(false);
    });

    const attendanceListener = onValue(attendanceRef, (snapshot) => {
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
            remarks: data[date][studentId].remarks || ""
          });
        });
      });

      // Keep it sorted by date descending then by student
      recordsArray.sort((a, b) => b.date.localeCompare(a.date) || a.studentId.localeCompare(b.studentId));
      setAttendanceRecords(recordsArray);
    });

    return () => {
      off(classRef, 'value', classListener);
      off(studentsRef, 'value', studentsListener);
      off(attendanceRef, 'value', attendanceListener);
    };
  }, [classId]);

  // Helpers
  const getTodayAttendance = (studentId, date = selectedDate) =>
    attendanceRecords.find((record) => record.studentId === studentId && record.date === date);

  const updateAttendanceStatus = async (studentId, status, remarks = "") => {
    try {
      await set(ref(db, `attendance/${classId}/${selectedDate}/${studentId}`), { status, remarks });
    } catch (e) {
      console.error("Error updating attendance:", e);
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
    }
  };

  const handleDeleteStudent = async (id) => {
    try {
      await remove(ref(db, `students/${classId}/${id}`));

      // Remove their attendance
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
    }
  };

  const handleSaveStudent = async () => {
    if (editingStudent) {
      try {
        await update(ref(db, `students/${classId}/${editingStudent.id}`), newStudent);
        setEditingStudent(null);
        setNewStudent({ name: "", rollNumber: "", email: "", phone: "" });
        setShowAddStudent(false);
      } catch (e) {
        console.error("Error updating student:", e);
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
      attendancePercentage: totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100) : 0
    };
  };

  const getClassStats = () => {
    const todayRecords = attendanceRecords.filter((r) => r.date === selectedDate);
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
      attendancePercentage: totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-900 via-violet-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  // Small presentational components
  const NavButton = ({ id, label, Icon }) => (
    <button
      onClick={() => { setActiveTab(id); setMobileMenuOpen(false); }}
      className={`flex items-center px-4 py-2 rounded-lg transition-all duration-150 text-sm md:text-base font-medium ${
        activeTab === id ? "bg-white text-slate-800 shadow" : "text-white hover:bg-white/10"
      }`}
      aria-pressed={activeTab === id}
    >
      <Icon className="w-4 h-4 mr-2" />
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden">{label.split(' ')[0]}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-900 via-violet-900 to-indigo-900 py-6">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <header className="bg-white/6 backdrop-blur-md rounded-2xl p-4 md:p-6 mb-6 border border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg shadow-md">AT</div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-white">Attendance Tracker</h1>
              <p className="text-xs md:text-sm text-gray-300">{classSettings.departmentName} • {classSettings.teacher} • {classSettings.semester}</p>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <div className="text-right">
              <p className="text-sm text-gray-300">Today's Attendance</p>
              <p className="text-xl font-bold text-green-300">{classStats.attendancePercentage}%</p>
              <p className="text-xs text-gray-400">{classStats.presentCount + classStats.lateCount}/{classStats.totalStudents}</p>
            </div>

            <div className="flex items-center space-x-3">
              <button onClick={() => { setShowAddStudent(true); setEditingStudent(null); setNewStudent({ name: "", rollNumber: "", email: "", phone: "" }); }} className="bg-green-500 hover:bg-green-600 px-3 py-2 rounded-md text-white flex items-center">
                <Plus className="w-4 h-4 mr-2" /> Add
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 text-white" onClick={() => setMobileMenuOpen((s) => !s)} aria-label="Open menu">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Navigation + content layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar (desktop) */}
          <aside className="hidden md:block md:col-span-1">
            <nav className="bg-white/5 backdrop-blur rounded-2xl p-4 space-y-3 border border-white/10 sticky top-6">
              <NavButton id="attendance" label="Take Attendance" Icon={UserCheck} />
              <NavButton id="students" label="Manage Students" Icon={Users} />
              <NavButton id="reports" label="Reports" Icon={BarChart3} />
              <NavButton id="calendar" label="Calendar View" Icon={Calendar} />

              <div className="mt-4 p-3 bg-white/3 rounded-lg">
                <p className="text-xs text-gray-300">Selected date</p>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-2 w-full bg-transparent text-white rounded-md px-3 py-2 border border-white/20" />
              </div>
            </nav>
          </aside>

          {/* Main area */}
          <main className="md:col-span-3">
            {/* Mobile nav (when open) */}
            {mobileMenuOpen && (
              <div className="mb-4 md:hidden">
                <div className="bg-white/6 p-3 rounded-xl border border-white/10 space-y-2">
                  <NavButton id="attendance" label="Take Attendance" Icon={UserCheck} />
                  <NavButton id="students" label="Manage Students" Icon={Users} />
                  <NavButton id="reports" label="Reports" Icon={BarChart3} />
                  <NavButton id="calendar" label="Calendar View" Icon={Calendar} />
                </div>
              </div>
            )}

            {/* Content card */}
            <div className="bg-white/6 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-white/10">

              {/* Attendance Tab */}
              {activeTab === "attendance" && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg md:text-2xl font-semibold text-white">Take Attendance</h2>
                    <div className="flex items-center space-x-3">
                      <label className="hidden md:block text-sm text-gray-300">Date</label>
                      <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-white rounded-md px-3 py-2 border border-white/20" />
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="rounded-xl p-4 text-center bg-white/4">
                      <UserCheck className="w-6 h-6 mx-auto mb-2 text-green-300" />
                      <p className="text-2xl font-bold text-white">{classStats.presentCount}</p>
                      <p className="text-xs text-green-200">Present</p>
                    </div>
                    <div className="rounded-xl p-4 text-center bg-white/4">
                      <Clock className="w-6 h-6 mx-auto mb-2 text-yellow-300" />
                      <p className="text-2xl font-bold text-white">{classStats.lateCount}</p>
                      <p className="text-xs text-yellow-200">Late</p>
                    </div>
                    <div className="rounded-xl p-4 text-center bg-white/4">
                      <UserX className="w-6 h-6 mx-auto mb-2 text-red-300" />
                      <p className="text-2xl font-bold text-white">{classStats.absentCount}</p>
                      <p className="text-xs text-red-200">Absent</p>
                    </div>
                    <div className="rounded-xl p-4 text-center bg-white/4">
                      <Users className="w-6 h-6 mx-auto mb-2 text-gray-200" />
                      <p className="text-2xl font-bold text-white">{classStats.notMarked}</p>
                      <p className="text-xs text-gray-300">Not Marked</p>
                    </div>
                  </div>

                  {/* Student list */}
                  <div className="space-y-3">
                    {students.map((student) => {
                      const attendance = getTodayAttendance(student.id);
                      return (
                        <div key={student.id} className="bg-white/4 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-semibold">{(student.name || "?").charAt(0)}</div>
                            <div>
                              <h3 className="text-sm md:text-base font-semibold text-white">{student.name}</h3>
                              <p className="text-xs text-gray-300">Roll: {student.rollNumber}</p>
                            </div>
                            {attendance && (
                              <span className={`ml-3 inline-flex items-center px-3 py-1 rounded-full text-xs ${getStatusColor(attendance.status)}`}>
                                {getStatusIcon(attendance.status)}
                                <span className="ml-1">{attendance.status.charAt(0).toUpperCase() + attendance.status.slice(1)}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button onClick={() => updateAttendanceStatus(student.id, "present")} className={`px-3 py-2 rounded-md transition ${attendance?.status === "present" ? "bg-green-500 text-white" : "bg-white/10 text-white hover:bg-green-500/20"}`} aria-label={`Mark ${student.name} present`}>
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => updateAttendanceStatus(student.id, "late")} className={`px-3 py-2 rounded-md transition ${attendance?.status === "late" ? "bg-yellow-500 text-white" : "bg-white/10 text-white hover:bg-yellow-500/20"}`} aria-label={`Mark ${student.name} late`}>
                              <Clock className="w-4 h-4" />
                            </button>
                            <button onClick={() => updateAttendanceStatus(student.id, "absent")} className={`px-3 py-2 rounded-md transition ${attendance?.status === "absent" ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-red-500/20"}`} aria-label={`Mark ${student.name} absent`}>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Students Tab */}
              {activeTab === "students" && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg md:text-2xl font-semibold text-white">Manage Students</h2>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setShowAddStudent(true); setEditingStudent(null); setNewStudent({ name: "", rollNumber: "", email: "", phone: "" }); }} className="bg-green-500 px-3 py-2 rounded-md text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Add Student</button>
                    </div>
                  </div>

                  {showAddStudent && (
                    <div className="bg-white/5 p-4 rounded-lg">
                      <h3 className="text-sm md:text-base font-semibold text-white mb-3">{editingStudent ? "Edit Student" : "Add New Student"}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="text" placeholder="Full Name" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} className="bg-transparent text-white rounded-md px-3 py-2 border border-white/20" />
                        <input type="text" placeholder="Roll Number" value={newStudent.rollNumber} onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })} className="bg-transparent text-white rounded-md px-3 py-2 border border-white/20" />
                        <input type="email" placeholder="Email Address" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} className="bg-transparent text-white rounded-md px-3 py-2 border border-white/20" />
                        <input type="tel" placeholder="Phone Number" value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} className="bg-transparent text-white rounded-md px-3 py-2 border border-white/20" />
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button onClick={handleSaveStudent} className="bg-blue-500 px-3 py-2 rounded-md text-white flex items-center gap-2"><Save className="w-4 h-4"/> {editingStudent ? 'Update' : 'Save'}</button>
                        <button onClick={() => { setShowAddStudent(false); setEditingStudent(null); setNewStudent({ name: "", rollNumber: "", email: "", phone: "" }); }} className="bg-white/10 px-3 py-2 rounded-md text-white">Cancel</button>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3">
                    {students.map((student) => (
                      <div key={student.id} className="bg-white/4 p-3 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 flex items-center justify-center text-white font-semibold">{(student.name || "?").charAt(0)}</div>
                          <div>
                            <h3 className="text-sm md:text-base font-semibold text-white">{student.name}</h3>
                            <p className="text-xs text-gray-300">Roll: {student.rollNumber}</p>
                            <p className="text-xs text-gray-400">{student.email} • {student.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditingStudent(student); setNewStudent({ name: student.name || "", rollNumber: student.rollNumber || "", email: student.email || "", phone: student.phone || "" }); setShowAddStudent(true); }} className="text-blue-200 p-2" title="Edit"><Edit3 className="w-4 h-4"/></button>
                          <button onClick={() => { if (window.confirm('Delete this student and their attendance?')) handleDeleteStudent(student.id); }} className="text-red-300 p-2" title="Delete"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Reports Tab */}
              {activeTab === "reports" && (
                <section className="space-y-6">
                  <h2 className="text-lg md:text-2xl font-semibold text-white">Attendance Reports</h2>
                  <div className="grid gap-4">
                    {students.map((student) => {
                      const stats = getAttendanceStats(student.id);
                      return (
                        <div key={student.id} className="bg-white/4 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-semibold">{(student.name || "?").charAt(0)}</div>
                              <div>
                                <h3 className="text-sm md:text-base font-semibold text-white">{student.name}</h3>
                                <p className="text-xs text-gray-300">Roll: {student.rollNumber}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-white">{stats.attendancePercentage}%</p>
                              <p className="text-xs text-gray-300">Overall Attendance</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2 text-center mb-3">
                            <div>
                              <p className="font-bold text-green-300">{stats.presentDays}</p>
                              <p className="text-xs text-gray-300">Present</p>
                            </div>
                            <div>
                              <p className="font-bold text-yellow-300">{stats.lateDays}</p>
                              <p className="text-xs text-gray-300">Late</p>
                            </div>
                            <div>
                              <p className="font-bold text-red-300">{stats.absentDays}</p>
                              <p className="text-xs text-gray-300">Absent</p>
                            </div>
                            <div>
                              <p className="font-bold text-white">{stats.totalDays}</p>
                              <p className="text-xs text-gray-300">Total Days</p>
                            </div>
                          </div>

                          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                            <div style={{ width: `${stats.attendancePercentage}%` }} className="h-2 rounded-full bg-gradient-to-r from-green-400 to-blue-400 transition-all" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Calendar Tab */}
              {activeTab === "calendar" && (
                <section className="space-y-6">
                  <h2 className="text-lg md:text-2xl font-semibold text-white">Calendar View</h2>
                  <div className="bg-white/4 p-4 rounded-lg text-center">
                    <Calendar className="w-12 h-12 mx-auto text-gray-300" />
                    <p className="text-sm text-gray-300 mt-2">Monthly Attendance Overview — pick a date to view details.</p>
                  </div>

                  <div className="bg-white/4 p-4 rounded-lg">
                    <h3 className="text-white font-semibold mb-3">Recent Attendance Summary</h3>
                    <div className="space-y-2">
                      {Array.from(new Set(attendanceRecords.map((r) => r.date))).sort().reverse().slice(0, 5).map((date) => {
                        const dayRecords = attendanceRecords.filter((r) => r.date === date);
                        const presentCount = dayRecords.filter((r) => r.status === "present").length;
                        const totalStudents = students.length || 1;
                        const percentage = Math.round((presentCount / totalStudents) * 100);
                        return (
                          <div key={date} className="flex justify-between items-center p-3 bg-white/6 rounded-md">
                            <div>
                              <p className="text-sm text-white font-semibold">{new Date(date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                              <p className="text-xs text-gray-300">{presentCount}/{totalStudents} present</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-white">{percentage}%</p>
                              <div className="w-28 bg-white/10 rounded-full h-2 mt-1 overflow-hidden">
                                <div style={{ width: `${percentage}%` }} className="h-2 rounded-full bg-gradient-to-r from-green-400 to-blue-400" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

            </div>
          </main>
        </div>

        {/* Mobile bottom bar */}
        <div className="fixed bottom-4 left-0 right-0 md:hidden px-4">
          <div className="max-w-3xl mx-auto bg-white/6 backdrop-blur rounded-full p-2 flex justify-between items-center border border-white/10">
            <button onClick={() => setActiveTab('attendance')} className={`flex-1 py-2 rounded-full ${activeTab==='attendance' ? 'bg-white text-slate-800' : 'text-white'}`} aria-label="Attendance">
              <UserCheck className="w-5 h-5 mx-auto" />
            </button>
            <button onClick={() => setActiveTab('students')} className={`flex-1 py-2 rounded-full ${activeTab==='students' ? 'bg-white text-slate-800' : 'text-white'}`} aria-label="Students">
              <Users className="w-5 h-5 mx-auto" />
            </button>
            <button onClick={() => setActiveTab('reports')} className={`flex-1 py-2 rounded-full ${activeTab==='reports' ? 'bg-white text-slate-800' : 'text-white'}`} aria-label="Reports">
              <BarChart3 className="w-5 h-5 mx-auto" />
            </button>
            <button onClick={() => setActiveTab('calendar')} className={`flex-1 py-2 rounded-full ${activeTab==='calendar' ? 'bg-white text-slate-800' : 'text-white'}`} aria-label="Calendar">
              <Calendar className="w-5 h-5 mx-auto" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}