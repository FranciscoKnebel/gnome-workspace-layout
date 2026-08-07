import type { OperationResult } from './result.js';
import { result } from './result.js';

export class OperationGate {
  private inProgress = false;

  run(operation: () => OperationResult): OperationResult {
    if (this.inProgress) {
      return result(
        ['Another workspace-layout operation is already running'],
        [],
      );
    }

    this.inProgress = true;
    try {
      return operation();
    } finally {
      this.inProgress = false;
    }
  }
}
