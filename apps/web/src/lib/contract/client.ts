export async function invokeContract(
  contractId: string,
  method: string,
  args: unknown[],
) {
  /**
   * Central location for Soroban invocation.
   *
   * Future implementation:
   * - build transaction
   * - sign transaction
   * - submit transaction
   * - wait for confirmation
   */
}