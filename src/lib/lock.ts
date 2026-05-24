import redis from './redis';

/**
 * Acquires a distributed lock using the SET NX PX pattern with a 10-second (10000ms) TTL.
 * 
 * @param key - The unique identifier for the resource lock.
 * @returns A promise that resolves to true if the lock was successfully acquired, and false otherwise.
 */
export async function acquireLock(key: string): Promise<boolean> {
  try {
    const result = await redis.set(key, 'locked', {
      nx: true,
      px: 10000, // 10 seconds TTL
    });
    
    return result === 'OK';
  } catch (error) {
    console.error(`Failed to acquire lock for key "${key}":`, error);
    return false;
  }
}

/**
 * Releases a distributed lock by deleting the key.
 * 
 * NOTE: Since the signature of releaseLock only accepts the lock key (without a unique client token), 
 * it directly deletes the key. In production scenarios with potential lock overruns (where a lock's execution 
 * outlasts the 10s TTL and a different client acquires the lock), it is recommended to extend the signature 
 * to pass a unique owner token to prevent accidentally releasing someone else's lock.
 * 
 * @param key - The unique identifier for the resource lock.
 */
export async function releaseLock(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`Failed to release lock for key "${key}":`, error);
  }
}
