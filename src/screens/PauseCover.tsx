import './pauseCover.css';

/**
 * Medan spelet är pausat täcker en ruta hela skärmen, så att ingen kan
 * spela. Spelledarens meny ligger ovanpå, så att hon kan fortsätta spelet
 * (Jonas 2026-11-18).
 */
export function PauseCover({ isLeader }: { isLeader: boolean }) {
  return (
    <div className="pause-cover" role="status">
      <h1>Spelet är pausat</h1>
      <p>{isLeader ? 'Fortsätt spelet i menyn.' : 'Spelledaren har pausat spelet. Vänta tills det fortsätter.'}</p>
    </div>
  );
}
