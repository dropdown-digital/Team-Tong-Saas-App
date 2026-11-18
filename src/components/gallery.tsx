"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Camera,
  Trophy,
  Sparkles,
  Flame,
  Laugh,
  Coffee,
  X,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Medal,
  Quote,
  Shield,
  ArrowRight,
} from "lucide-react";
import { Title } from "./ui";

export interface GalleryMoment {
  id: string;
  src: string;
  title: string;
  category: "all" | "squad" | "trophy" | "banter" | "recovery";
  tag: string;
  badge: string;
  subtitle: string;
  humourNote: string;
  matchdayTruth: string;
  mvp: string;
  location: string;
}

export const GALLERY_MOMENTS: GalleryMoment[] = [
  {
    id: "moment-01",
    src: "/images/gallery/moment-01.jpg",
    title: "The 30-Man '7-a-Side' Attendance Record",
    category: "squad",
    tag: "Squad Goals",
    badge: "Overbooked FC",
    subtitle: "When everyone actually replies 'going' in WhatsApp and subs queue is longer than the pitch.",
    humourNote: "Half the squad arrived 25 minutes late citing 'severe traffic at Mohakhali flyover', yet miraculously managed to position themselves right in the center for the photo.",
    matchdayTruth: "Subs rotation negotiation: 'Bro just 2 more minutes, I haven't even touched the ball yet.'",
    mvp: "Whoever brought the extra ball that didn't go over the 20-foot fence.",
    location: "Turf Arena, Dhaka"
  },
  {
    id: "moment-02",
    src: "/images/gallery/moment-02.jpg",
    title: "Champions of Everything That Matters",
    category: "trophy",
    tag: "Trophy Glory",
    badge: "Gold Standard",
    subtitle: "Lifting the cup like we just knocked Real Madrid out of the Champions League quarter-finals.",
    humourNote: "We won 4-3 on aggregate, but if you listen to the post-match breakdown at the local tong, we played like 2011 Pep Guardiola Barcelona with extra tiki-taka.",
    matchdayTruth: "Trophy weight: 2.1 kg. The emotional weight of bragging rights in the WhatsApp group: immeasurable.",
    mvp: "The guy gripping the cup with both hands who played 6 minutes as an emergency defender.",
    location: "Champions Pitch, Dhaka"
  },
  {
    id: "moment-03",
    src: "/images/gallery/moment-03.jpg",
    title: "Multiverse of Kits & Zero Coordination",
    category: "squad",
    tag: "Kit Clash",
    badge: "FIFA Licensed Chaos",
    subtitle: "Real Madrid '98 Teka, modern Spain, Argentina Messi #10, and gym casuals in complete peace.",
    humourNote: "Kit coordinator officially retired in 2024. As long as you aren't wearing formal trousers and office shoes, you are starting on the wing.",
    matchdayTruth: "Messi #10 kit owner attempted 8 solo runs from his own penalty box. Completed: 0. Swagger rating: 10/10.",
    mvp: "Teka Madrid retro kit owner for keeping 90s football aesthetics alive.",
    location: "Turf Ground 2"
  },
  {
    id: "moment-04",
    src: "/images/gallery/moment-04.jpg",
    title: "Thumbs Up, Knees Broken",
    category: "recovery",
    tag: "Post-Match Survival",
    badge: "Lactic Acid Alert",
    subtitle: "Big smiles for the camera lens, intense quad burning on the inside.",
    humourNote: "Check out the goalkeeper in the kaleidoscopic shorts. He produced 19 reflex saves and then spent 15 minutes searching for his car keys on the artificial grass.",
    matchdayTruth: "Every thumb pointed up in this picture is an SOS signal for deep heat spray and ice packs.",
    mvp: "The keeper's colorful shorts for actively distracting opposing strikers from 20 yards.",
    location: "Night Turf Arena"
  },
  {
    id: "moment-05",
    src: "/images/gallery/moment-05.jpg",
    title: "The Five-Finger Conspiracy",
    category: "banter",
    tag: "Tactical Secrets",
    badge: "Scoreline Mystery",
    subtitle: "Displaying 5 fingers: goals scored, goals conceded, or rounds of malai cha ordered?",
    humourNote: "Nobody agreed on the hand sign before the countdown. Three guys showed 5, two showed 7, and the center midfielder was just holding his cramping calf.",
    matchdayTruth: "Official match score remains heavily contested: Team White claims 7-5, Team Colors insists the lights went out at 6-6.",
    mvp: "The kneeling player in center for enduring severe rubber pellet burns on his knees for this shot.",
    location: "Pitch 1"
  },
  {
    id: "moment-06",
    src: "/images/gallery/moment-06.jpg",
    title: "Neon Glove Masterclass & The Wall",
    category: "banter",
    tag: "Goalkeeper Union",
    badge: "Prime Courtois",
    subtitle: "When the goalie buys fluorescent gloves on discount and suddenly repels every bullet header.",
    humourNote: "He claimed the floodlights blinded him on the 2 goals conceded, but took 100% tactical credit for a crossbar rebound that hit him in the ribs.",
    matchdayTruth: "Ball clearance over the back fence count: exactly 3. Total match minutes lost retrieving ball from rooftop: 22.",
    mvp: "The neon gloves. They possessed psychic goalkeeping powers tonight.",
    location: "Turf Under Lights"
  },
  {
    id: "moment-07",
    src: "/images/gallery/moment-07.jpg",
    title: "The Black Kit Syndicate",
    category: "squad",
    tag: "Dark Horse FC",
    badge: "Intimidation 100",
    subtitle: "Looking ruthlessly intimidating in all-black kits until minute 12 when everyone asks for water.",
    humourNote: "The collective age of this midfield is a classified state secret. Sprinting stamina noticeably declines after 11:15 PM.",
    matchdayTruth: "7 players in this photo explicitly swore this was their 'last game of the month' before rebooking the turf 40 minutes later.",
    mvp: "The vintage AIG Manchester United jersey for surviving aggressive slide tackles on turf pellets.",
    location: "Midnight Arena"
  },
  {
    id: "moment-08",
    src: "/images/gallery/moment-08.jpg",
    title: "Horizontal Aftermath (Tong Awaits)",
    category: "recovery",
    tag: "Tong Culture",
    badge: "Zero Energy Remaining",
    subtitle: "20 exhausted warriors collapsed on the turf contemplating life before the hot cha arrives.",
    humourNote: "The player lying flat in the center has achieved absolute zen. He cannot feel his legs, but he remembers scoring a top-corner volley.",
    matchdayTruth: "Post-match conversation ratio: 10% football analysis, 90% fiercely debating whose bKash gets the turf rent.",
    mvp: "The turf groundkeeper who let us play 8 minutes into the next booking slot without kicking us off.",
    location: "Central Turf Pitch"
  },
  {
    id: "moment-09",
    src: "/images/gallery/moment-09.jpg",
    title: "Class of '90: The Midfield Theorists",
    category: "squad",
    tag: "Retro Royalty",
    badge: "Tactical Geniuses",
    subtitle: "Germany 1990 chevron kit meets Arsenal, AC Milan Bwin, and Teka Madrid.",
    humourNote: "Over 400 collective matches of tactical knowledge, yet zero midfielders tracked back when the opposing 19-year-old winger broke on the counter.",
    matchdayTruth: "'I'm playing as a False 9 today' directly translates to 'I am physically unable to jog back into defense.'",
    mvp: "Germany '90 retro shirt for cleanest drip in Dhaka amateur football.",
    location: "Turf Pitch A"
  },
  {
    id: "moment-10",
    src: "/images/gallery/moment-10.jpg",
    title: "Certified Turf Banter Champions",
    category: "banter",
    tag: "Pure Energy",
    badge: "Matchday Royalty",
    subtitle: "Late-night euphoria after 75 minutes of end-to-end breathless chaos and zero red cards.",
    humourNote: "Everyone is grinning because tomorrow is Saturday and they can spend the morning sleeping with pain relief ointment.",
    matchdayTruth: "Final verdict: Football was played, but the local tong tea stall made the undisputed financial profit tonight.",
    mvp: "The whole squad for showing up every single week, rain or shine, work stress or dead legs.",
    location: "Turf Arena Dhaka"
  }
];

export function Gallery() {
  const [filter, setFilter] = useState<string>("all");
  const [activeMoment, setActiveMoment] = useState<GalleryMoment | null>(null);
  const [reactions, setReactions] = useState<Record<string, number>>({});

  const filtered = filter === "all" 
    ? GALLERY_MOMENTS 
    : GALLERY_MOMENTS.filter((m) => m.category === filter);

  const handleReaction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReactions((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeMoment) return;
    const currentIndex = GALLERY_MOMENTS.findIndex((m) => m.id === activeMoment.id);
    const nextIndex = (currentIndex + 1) % GALLERY_MOMENTS.length;
    setActiveMoment(GALLERY_MOMENTS[nextIndex]);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeMoment) return;
    const currentIndex = GALLERY_MOMENTS.findIndex((m) => m.id === activeMoment.id);
    const prevIndex = (currentIndex - 1 + GALLERY_MOMENTS.length) % GALLERY_MOMENTS.length;
    setActiveMoment(GALLERY_MOMENTS[prevIndex]);
  };

  return (
    <div className="gallery-page">
      <Title
        eyebrow="UNFILTERED MATCHDAY ARCHIVES"
        title="The Gallery of Legends."
        subtitle="Where tactics are optional, arguments at the tong are mandatory, and everyone claims they were fouled in the box."
        action={
          <div className="gallery-header-meta">
            <span className="gallery-pill">
              <Trophy size={14} className="text-gold" /> 1 Golden Trophy
            </span>
            <span className="gallery-pill">
              <Flame size={14} /> 10 Legendary Moments
            </span>
            <span className="gallery-pill">
              <Coffee size={14} /> ∞ Tong Cha Cups
            </span>
          </div>
        }
      />

      {/* Hero Banner with Team Tong Crest */}
      <section className="gallery-hero-banner">
        <div className="gallery-banner-content">
          <div className="gallery-logo-wrap">
            <img
              src="/images/logo.jpg"
              alt="Team Tong Crest"
              className="gallery-hero-logo"
            />
            <div className="logo-sparkle">
              <Sparkles size={16} />
            </div>
          </div>
          <div>
            <span className="eyebrow">
              <span className="dot" /> OFFICIAL TEAM TONG MEMORIES
            </span>
            <h2>
              Blood, Sweat, &amp; <em>Midnight Tong Cha</em>
            </h2>
            <p>
              Under the Dhaka turf floodlights, we play hard, miss open sitters even harder,
              and celebrate every win like a Champions League treble. Here is the visual proof.
            </p>
          </div>
        </div>
        <div className="gallery-stats-banner">
          <div className="stat-item">
            <span className="stat-val">10</span>
            <span className="stat-lbl">Iconic Moments</span>
          </div>
          <div className="stat-item">
            <span className="stat-val">100%</span>
            <span className="stat-lbl">bKash Cleared</span>
          </div>
          <div className="stat-item">
            <span className="stat-val">0</span>
            <span className="stat-lbl">Yellow Cards Paid</span>
          </div>
          <div className="stat-item">
            <span className="stat-val">99+</span>
            <span className="stat-lbl">Legs Cramped</span>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="gallery-filter-bar">
        <button
          className={`filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All Moments ({GALLERY_MOMENTS.length})
        </button>
        <button
          className={`filter-btn ${filter === "trophy" ? "active" : ""}`}
          onClick={() => setFilter("trophy")}
        >
          <Trophy size={14} /> Trophy &amp; Glory
        </button>
        <button
          className={`filter-btn ${filter === "squad" ? "active" : ""}`}
          onClick={() => setFilter("squad")}
        >
          <Shield size={14} /> The Squad
        </button>
        <button
          className={`filter-btn ${filter === "banter" ? "active" : ""}`}
          onClick={() => setFilter("banter")}
        >
          <Laugh size={14} /> Pure Banter
        </button>
        <button
          className={`filter-btn ${filter === "recovery" ? "active" : ""}`}
          onClick={() => setFilter("recovery")}
        >
          <Coffee size={14} /> Recovery &amp; Tong
        </button>
      </div>

      {/* Gallery Grid */}
      <div className="gallery-grid">
        {filtered.map((item, idx) => (
          <div
            key={item.id}
            className="gallery-card"
            onClick={() => setActiveMoment(item)}
          >
            <div className="card-media-wrap">
              <img
                src={item.src}
                alt={item.title}
                loading="lazy"
                className="gallery-img"
              />
              <div className="card-badge">{item.badge}</div>
              <div className="card-tag">{item.tag}</div>
              <button
                className="reaction-heart"
                onClick={(e) => handleReaction(item.id, e)}
                title="Cheer for this moment"
              >
                ❤️ <span>{(reactions[item.id] || 0) + (idx * 3 + 12)}</span>
              </button>
            </div>

            <div className="card-body">
              <div className="card-meta">
                <span className="card-loc">
                  <MapPin size={12} /> {item.location}
                </span>
              </div>
              <h3 className="card-title">{item.title}</h3>
              <p className="card-subtitle">{item.subtitle}</p>

              <div className="humour-quote">
                <Quote size={14} className="quote-icon" />
                <p>{item.humourNote}</p>
              </div>

              <div className="card-footer">
                <div className="truth-box">
                  <span className="truth-label">Matchday Reality:</span>
                  <span className="truth-text">{item.matchdayTruth}</span>
                </div>
                <div className="mvp-tag">
                  <Medal size={13} />
                  <span>MVP: {item.mvp}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {activeMoment && (
        <div className="gallery-lightbox" onClick={() => setActiveMoment(null)}>
          <div
            className="lightbox-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="lightbox-close"
              onClick={() => setActiveMoment(null)}
              aria-label="Close photo view"
            >
              <X size={20} />
            </button>

            <button
              className="lightbox-nav prev"
              onClick={handlePrev}
              aria-label="Previous photo"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              className="lightbox-nav next"
              onClick={handleNext}
              aria-label="Next photo"
            >
              <ChevronRight size={24} />
            </button>

            <div className="lightbox-media">
              <img src={activeMoment.src} alt={activeMoment.title} />
              <div className="lightbox-badge">{activeMoment.badge}</div>
            </div>

            <div className="lightbox-details">
              <div className="lightbox-header">
                <span className="card-tag">{activeMoment.tag}</span>
                <span className="card-loc">
                  <MapPin size={14} /> {activeMoment.location}
                </span>
              </div>

              <h2>{activeMoment.title}</h2>
              <p className="lightbox-sub">{activeMoment.subtitle}</p>

              <div className="lightbox-humour">
                <h4>
                  <Laugh size={17} /> The Dressing Room Story
                </h4>
                <p>{activeMoment.humourNote}</p>
              </div>

              <div className="lightbox-truth">
                <h4>
                  <Flame size={17} /> Matchday Reality
                </h4>
                <p>{activeMoment.matchdayTruth}</p>
              </div>

              <div className="lightbox-mvp">
                <Medal size={18} />
                <div>
                  <strong>Matchday Honorary Award:</strong>
                  <p>{activeMoment.mvp}</p>
                </div>
              </div>

              <div className="lightbox-footer">
                <button
                  className="button"
                  onClick={(e) => handleReaction(activeMoment.id, e)}
                >
                  ❤️ Give Cheers ({(reactions[activeMoment.id] || 0) + 15})
                </button>
                <span className="tiny">Photo ID: {activeMoment.id} • Team Tong Archives</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
