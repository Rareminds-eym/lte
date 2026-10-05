import { dispatchReviewWork } from '@functions/lib/human-review/dispatch';
import type { LteEnv } from '@functions/lib/types';

export default {
  async scheduled(_event: unknown, env: LteEnv): Promise<void> {
    await dispatchReviewWork(env);
  },
};
