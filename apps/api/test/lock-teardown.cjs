module.exports = async () => {
  globalThis.__releaseTestLock?.();
};
