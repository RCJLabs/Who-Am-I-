// The on-device analysis of a user's results. Pure: rules over the answers and content, no network.
// Sections describe what the user sees (everything they answered); the summary and
// recommendations use only the shareable profile, so sensitive answers never shape them.
import type { AxisId } from '../../model/content.ts';
import type { Profile } from '../../model/profile.ts';
import type { FlowOptions } from '../flow.ts';
import { observe } from '../observe.ts';
import type { AnswerState } from '../state.ts';
import type { Tension } from '../tensions.ts';
import { axisFacts, principleFacts } from './axes.ts';
import { casesFor } from './cases.ts';
import { exploreNext } from './explore.ts';
import { firmPositions } from './positions.ts';
import { publicTension, reflections } from './reflect.ts';
import type { AnalysisFacts } from './types.ts';

export interface AnalysisInput {
  state: AnswerState;
  /** Built with includeSensitive: true (what the user sees). */
  profile: Profile;
  /** Built with includeSensitive: false (what the summary and recommendations may use). */
  publicProfile: Profile;
  tensions: readonly Tension[];
  flow?: FlowOptions;
  /** Spectrums drawn on the political map. */
  mapAxes?: readonly AxisId[];
}

export function analyse(i: AnalysisInput): AnalysisFacts {
  const s = i.state;
  const b = s.ix.bundle;
  const flow = i.flow ?? {};
  const positions = firmPositions(s, i.publicProfile);
  const open = i.tensions.filter((t) => t.status === 'open' && publicTension(s, t)).sort((x, y) => y.rank - x.rank);
  return {
    axes: axisFacts(b, i.profile, observe(s, { includeSensitive: true })),
    principles: principleFacts(b, i.profile),
    public: {
      axes: axisFacts(b, i.publicProfile, observe(s, { includeSensitive: false })),
      principles: principleFacts(b, i.publicProfile),
      positions,
      tensions: { open: open.length, top: open[0]?.principle ?? null },
    },
    next: {
      cases: casesFor(s, positions, flow),
      explore: exploreNext(s, i.publicProfile, { ...flow, ...(i.mapAxes ? { mapAxes: i.mapAxes } : {}) }),
      reflect: reflections(s, i.tensions),
    },
  };
}

export type * from './types.ts';
