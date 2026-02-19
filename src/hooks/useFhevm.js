// hooks/useFhevm.js
import { useState, useEffect, useCallback } from 'react';

export const useFhevm = () => {
  const [instance, setInstance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const init = useCallback(
    async provider => {
      if (instance || isLoading) return instance;

      setIsLoading(true);
      setError(null);

      try {
        // Динамический импорт чтобы избежать SES проблем
        const { initSDK, createInstance, SepoliaConfig } = await import(
          '@zama-fhe/relayer-sdk/web'
        );

        // Инициализация SDK
        await initSDK();

        // Создание instance
        const fheInstance = await createInstance({
          ...SepoliaConfig,
          network: provider,
        });

        setInstance(fheInstance);
        return fheInstance;
      } catch (err) {
        console.error('FHE initialization failed:', err);
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [instance, isLoading]
  );

  const reset = useCallback(() => {
    setInstance(null);
    setError(null);
  }, []);

  return {
    instance,
    isLoading,
    error,
    init,
    reset,
  };
};
