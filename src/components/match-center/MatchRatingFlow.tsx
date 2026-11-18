"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowRight, LockKeyhole, Star } from "lucide-react";
import { useClub } from "../provider";
import {
  type Match,
  ballotTargets,
  participants,
  saveDraft,
  submitBallot,
  votingIsOpen,
  canSeeResults,
  communityRating,
  voteCount,
  ratingSample,
} from "@/lib/domain";
import { teamName, contributions } from "@/lib/lineup";
import { RatingInput } from "./RatingInput";
import { PlayerPortrait, RatingBadge } from "./PlayerMarker";

export function MatchRatingFlow({
  match: m,
  now,
  initialTarget,
}: {
  match: Match;
  now: number;
  initialTarget?: string;
}) {
  const { s, mutate, update, live } = useClub();
  const router = useRouter();
  const [index, setIndex] = useState(() =>
    Math.max(0, ballotTargets(m, s.viewer).indexOf(initialTarget || "")),
  );
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const targets = ballotTargets(m, s.viewer);
  const draft = m.drafts?.[s.viewer] || {};
  const done = targets.filter((id) => draft[id] !== undefined).length;
  const submitted = canSeeResults(m, s.viewer);
  const eligible = participants(m).includes(s.viewer);
  const open = votingIsOpen(m, now);
  const target = targets[Math.min(index, targets.length - 1)];
  const player = s.players.find((p) => p.id === target);
  const viewer = s.players.find((p) => p.id === s.viewer);
  function sample() {
    const example = ratingSample();
    example.id = crypto.randomUUID();
    example.venue = "Rating walkthrough · fictional sample match";
    example.voting = true;
    example.votingDeadline = new Date(Date.now() + 48 * 3600000).toISOString();
    update((s) => {
      s.matches.unshift(example);
      s.viewer = "p1";
    });
    router.push(`/matches/${example.id}`);
  }
  return (
    <section className="ballot-flow" aria-label="Match rating ballot">
      <div className="ballot-heading">
        <span className="eyebrow">
          <Star size={15} /> THE POST-MATCH RITUAL
        </span>
        <h1>
          {submitted ? "Your voice is in." : "Good game. Give some credit."}
        </h1>
        <p>
          {submitted
            ? "Your complete ballot is locked. Here’s how the squad saw the match."
            : "Rate everyone who played, take one last look, then submit together."}
        </p>
      </div>
      <p className="ballot-identity">
        {live ? "Signed in as" : "Local demo as"}{" "}
        <strong>{viewer?.name}</strong> · {participants(m).length} actual
        participants
      </p>
      {submitted ? (
        <>
          <div className="ballot-success">
            <Check size={20} />
            <div>
              <b>Ballot submitted & permanently locked</b>
              <p>No edits or resubmission, even if voting reopens.</p>
            </div>
          </div>
          <div className="ballot-results-heading">
            <h2>Community results</h2>
            <span className={open ? "ballot-status" : "ballot-status final"}>
              {open ? "Provisional" : "Final"}
            </span>
          </div>
          <p className="mc-fine">
            {open
              ? "Voting is still open. Averages and counts may change as more complete ballots arrive."
              : "Voting is closed. These are the final results for this voting window."}{" "}
            Averages need at least three votes. Individual votes and voter names
            are never displayed here.
          </p>
          <div className="ballot-results">
            {participants(m).map((id) => {
              const p = s.players.find((p) => p.id === id)!;
              const count = voteCount(m, id);
              return (
                <div className="ballot-result" key={id}>
                  <PlayerPortrait player={p} />
                  <span>
                    <b>
                      {p.name}
                      {id === s.viewer ? " · You" : ""}
                    </b>
                    <small>
                      {teamName(m.teams[0].includes(id) ? 0 : 1)} · {count}{" "}
                      {count === 1 ? "vote" : "votes"}
                      {count < 3 ? " · Needs 3" : ""}
                    </small>
                  </span>
                  <RatingBadge value={communityRating(m, id, s.viewer)} />
                </div>
              );
            })}
          </div>
        </>
      ) : m.status !== "completed" ? (
        <div className="ballot-notice">
          <LockKeyhole />
          <h2>The final whistle comes first.</h2>
          <p>
            Ratings open after the organizer ends the match and records who
            played.
          </p>
        </div>
      ) : live && m.eligibilityFrozen === false ? (
        <div className="ballot-notice">
          <LockKeyhole />
          <h2>Waiting for the organizer.</h2>
          <p>
            The organizer will confirm who actually played and open the rating
            window. Results stay hidden.
          </p>
        </div>
      ) : !eligible ? (
        <div className="ballot-notice">
          <LockKeyhole />
          <h2>Only players who took part can rate.</h2>
          <p>
            Results stay hidden. Only an approved member who played in this
            match can submit a ballot.
          </p>
        </div>
      ) : !open ? (
        <div className="ballot-notice">
          <LockKeyhole />
          <h2>This voting window is closed.</h2>
          <p>
            You haven’t submitted a complete ballot, so results stay hidden.
          </p>
          {!live && (
            <button onClick={sample}>
              Try a sample match <ArrowRight size={16} />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="ballot-progress">
            <div>
              <b>
                {done} of {targets.length} rated
              </b>
              <span>
                {review
                  ? "Review your ballot"
                  : `${Math.min(index + 1, targets.length)} / ${targets.length}`}
              </span>
            </div>
            <progress
              aria-label="Rating progress"
              value={done}
              max={targets.length}
            />
            <small>
              Your draft saves as you go. Results stay hidden until you submit.
            </small>
          </div>
          {review ? (
            <div className="ballot-review">
              <h2>One last look.</h2>
              <p>
                These are your private draft choices. Submitting locks the
                entire ballot.
              </p>
              {targets.map((id, i) => {
                const p = s.players.find((p) => p.id === id)!;
                return (
                  <div className="ballot-review-row" key={id}>
                    <span>{p.name}</span>
                    <b>{draft[id]?.toFixed(1) || "Not rated"}</b>
                    <button
                      className="secondary"
                      aria-label={`Edit rating for ${p.name}`}
                      onClick={() => {
                        setIndex(i);
                        setReview(false);
                        setConfirmed(false);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
              <label className="ballot-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                I understand that I cannot change any rating after submitting.
              </label>
              <button
                className="ballot-primary"
                disabled={!confirmed || done !== targets.length}
                onClick={() => mutate(m.id, (m) => submitBallot(m, s.viewer))}
              >
                Submit & lock all {targets.length} ratings{" "}
                <LockKeyhole size={17} />
              </button>
              <button className="secondary" onClick={() => setReview(false)}>
                Back to rating
              </button>
            </div>
          ) : player ? (
            <div className="ballot-player">
              <div className="ballot-player-top">
                <PlayerPortrait player={player} />
                <span>
                  <small>
                    {teamName(m.teams[0].includes(player.id) ? 0 : 1)} ·{" "}
                    {player.position}
                  </small>
                  <h2>{player.name}</h2>
                  <p>
                    {contributions(m, player.id).goals} goals ·{" "}
                    {contributions(m, player.id).assists} assists ·{" "}
                    {contributions(m, player.id).minutes} minutes
                  </p>
                </span>
              </div>
              <RatingInput
                name={player.name}
                value={draft[target]}
                onChange={(value) =>
                  mutate(m.id, (m) => saveDraft(m, s.viewer, target, value))
                }
              />
              <div className="ballot-navigation">
                <button
                  className="secondary"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  Previous
                </button>
                <button
                  disabled={draft[target] === undefined}
                  onClick={() =>
                    index < targets.length - 1
                      ? setIndex((i) => i + 1)
                      : setReview(true)
                  }
                >
                  {index < targets.length - 1 ? "Next player" : "Review ballot"}
                  <ArrowRight size={17} />
                </button>
              </div>
              {done === targets.length && (
                <button
                  className="ballot-primary"
                  onClick={() => setReview(true)}
                >
                  Review all {targets.length} ratings
                </button>
              )}
            </div>
          ) : (
            <p>No other actual participants are recorded.</p>
          )}
        </>
      )}
      <p className="ballot-disclaimer">
        <LockKeyhole size={15} />
        {live
          ? "Private club: identity, eligibility, submission locks and result access are checked on the server. Individual ballots are never included in shared results."
          : "Local demo only. The viewer selector is not sign-in. Locks and anonymity apply to the interface, not real security: browser storage, backups and developer tools expose or can change demo data. Votes are not shared across devices."}
      </p>
    </section>
  );
}
