import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  query,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged
} from 'firebase/auth';
import {
  Search,
  Play,
  Plus,
  X,
  Filter,
  Layout,
  Code,
  TrendingUp,
  CheckCircle2,
  Video,
  ExternalLink,
  Loader2
} from 'lucide-react';

/**
 * FIREBASE CONFIGURATION
 * These variables are provided by the environment at runtime.
 */
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "mock-key",
  authDomain: "mock.firebaseapp.com",
  projectId: "mock-project",
  storageBucket: "mock.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'project-shikkha-v2';

// Helper to extract YouTube ID from any YouTube URL
const getYouTubeID = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Initial Seed Data (A subset of the 304 lessons to start with)
const INITIAL_LESSONS = [
  { n: 1, t: "শিক্ষা ল্যাবে স্বাগতম", id: "U0HQwhJYTWM", track: "Fundamental" },
  { n: 2, t: "যোগাযোগের মাধ্যম", id: "MZvykdX0kb8", track: "Fundamental" },
  { n: 3, t: "কোর্স পরিচিতি", id: "7q2AN1VZGS8", track: "Fundamental" },
  { n: 14, t: "যোগাযোগের নিয়মাবলী", id: "6VTp8_wMMFM", track: "Fundamental" },
  { n: 15, t: "এসবিএআর (SBAR)", id: "Al8kkSP_auE", track: "Fundamental" },
  { n: 23, t: "Typing: Digital Mastery", id: "w_stMR7PteY", track: "Fundamental" },
  { n: 73, t: "Search Engine Introduction", id: "sBAiKEHb3_o", track: "Fundamental" },
  { n: 129, t: "Dorking Skills: Intro", id: "Qm3CJvPDSAg", track: "Fundamental" },
  { n: 249, t: "Engineering Workspace & Strategy", id: "yzFo6X8OuyQ", track: "Engineering" },
  { n: 296, t: "Marketing Live Class", id: "Y-KGEMF_pT4", track: "Marketing" },
  { n: 304, t: "Marketing: Emotional Drivers", id: "CE-IJ_DQpkc", track: "Marketing" }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTrack, setActiveTrack] = useState("All");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newVideoTitle, setNewVideoTitle] = useState("");
  const [newVideoTrack, setNewVideoTrack] = useState("Fundamental");
  const [newVideoNumber, setNewVideoNumber] = useState("");

  /**
   * 1. AUTHENTICATION (Mandatory Rule 3)
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed:", err);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  /**
   * 2. DATA FETCHING & SEEDING
   */
  useEffect(() => {
    if (!user) return;

    // Path following Rule 1
    const videosRef = collection(db, 'artifacts', appId, 'public', 'data', 'lessons');

    // Sync from Firestore
    const unsubscribe = onSnapshot(videosRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // If database is empty, seed with initial data
      if (data.length === 0 && loading) {
        seedInitialData();
      } else {
        setVideos(data.sort((a, b) => a.n - b.n));
        setLoading(false);
      }
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const seedInitialData = async () => {
    const videosRef = collection(db, 'artifacts', appId, 'public', 'data', 'lessons');
    // Using batch for efficiency if seeding many items
    for (const item of INITIAL_LESSONS) {
      await addDoc(videosRef, item);
    }
  };

  /**
   * 3. ADD VIDEO LOGIC
   */
  const handleAddVideo = async (e) => {
    e.preventDefault();
    const ytId = getYouTubeID(newVideoUrl);
    if (!ytId) return alert("Invalid YouTube URL");

    try {
      const videosRef = collection(db, 'artifacts', appId, 'public', 'data', 'lessons');
      await addDoc(videosRef, {
        n: parseInt(newVideoNumber) || (videos.length + 1),
        t: newVideoTitle || `Lesson ${newVideoNumber}`,
        id: ytId,
        track: newVideoTrack
      });
      setIsAddModalOpen(false);
      setNewVideoUrl("");
      setNewVideoTitle("");
      setNewVideoNumber("");
    } catch (err) {
      console.error("Add failed:", err);
    }
  };

  /**
   * 4. FILTERING & SEARCH (Rule 2: Logic in memory)
   */
  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const matchesSearch = v.t.toLowerCase().includes(search.toLowerCase()) ||
        v.n.toString().includes(search);
      const matchesTrack = activeTrack === "All" || v.track === activeTrack;
      return matchesSearch && matchesTrack;
    });
  }, [videos, search, activeTrack]);

  // Derived stats
  const stats = useMemo(() => ({
    total: videos.length,
    fundamental: videos.filter(v => v.track === 'Fundamental').length,
    engineering: videos.filter(v => v.track === 'Engineering').length,
    marketing: videos.filter(v => v.track === 'Marketing').length,
  }), [videos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Video className="w-6 h-6" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold leading-tight">শিক্ষা ল্যাব ২.০</h1>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">ইঞ্জিনিয়ারিং ও মার্কেটিং রিসোর্স</p>
            </div>
          </div>

          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title or class number..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">Add Lesson</span>
          </button>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Statistics & Filters */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="text-2xl font-bold mb-1">লার্নিং ড্যাশবোর্ড</h2>
            <p className="text-slate-500 text-sm">আপনার জন্য মোট {stats.total} টি ক্লাস বরাদ্দ করা আছে</p>
          </div>

          <div className="flex flex-wrap gap-2 p-1 bg-slate-200 rounded-2xl w-fit">
            {['All', 'Fundamental', 'Engineering', 'Marketing'].map((track) => (
              <button
                key={track}
                onClick={() => setActiveTrack(track)}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeTrack === track
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {track === 'All' ? 'সব ক্লাস' : track}
              </button>
            ))}
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => (
            <div
              key={video.id + video.n}
              className="group bg-white rounded-3xl overflow-hidden border border-slate-200 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer flex flex-col"
              onClick={() => setSelectedVideo(video)}
            >
              <div className="relative aspect-video bg-slate-100 overflow-hidden">
                <img
                  src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                  alt={video.t}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-xl">
                    <Play className="w-5 h-5 fill-current ml-1" />
                  </div>
                </div>
                <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-lg font-bold tracking-widest uppercase">
                  Class {video.n}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    {video.track === 'Fundamental' && <Layout className="w-3 h-3 text-orange-500" />}
                    {video.track === 'Engineering' && <Code className="w-3 h-3 text-blue-500" />}
                    {video.track === 'Marketing' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${video.track === 'Fundamental' ? 'text-orange-500' :
                        video.track === 'Engineering' ? 'text-blue-500' : 'text-emerald-500'
                      }`}>
                      {video.track}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {video.t}
                  </h3>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-slate-400">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-300" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Ready to watch</span>
                  </div>
                  <ExternalLink className="w-3 h-3 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {filteredVideos.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <Search className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold">No videos found</h3>
              <p className="text-slate-500 text-sm">Try adjusting your search or track filters.</p>
            </div>
          )}
        </div>
      </main>

      {/* --- ADD VIDEO MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <form
            onSubmit={handleAddVideo}
            className="relative w-full max-w-lg bg-white rounded-[32px] p-8 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                নতুন ক্লাস যোগ করুন
              </h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">YouTube URL</label>
                <input
                  required
                  type="url"
                  placeholder="https://youtu.be/..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Class Number</label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 305"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                    value={newVideoNumber}
                    onChange={(e) => setNewVideoNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Track</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                    value={newVideoTrack}
                    onChange={(e) => setNewVideoTrack(e.target.value)}
                  >
                    <option value="Fundamental">Fundamental</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Lesson Title</label>
                <input
                  required
                  type="text"
                  placeholder="Enter lesson title..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-8 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95"
            >
              সেভ করুন
            </button>
          </form>
        </div>
      )}

      {/* --- VIDEO PLAYER MODAL --- */}
      {selectedVideo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md" onClick={() => setSelectedVideo(null)} />
          <div className="relative w-full max-w-5xl bg-black aspect-video sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <button
              onClick={() => setSelectedVideo(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 bg-white/10 hover:bg-red-500 rounded-full text-white flex items-center justify-center transition-all backdrop-blur-md"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1&rel=0`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}
