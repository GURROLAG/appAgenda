import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

interface TemaContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  colors: {
    background: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
    primary: string;
    danger: string;
    overlay: string;
    input: string;
  };
}

const TemaContext = createContext<TemaContextType>({} as TemaContextType);

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('darkMode').then((val) => {
      if (val !== null) setDarkMode(val === 'true');
    });
  }, []);

  const toggleDarkMode = async () => {
    const nuevo = !darkMode;
    setDarkMode(nuevo);
    await AsyncStorage.setItem('darkMode', String(nuevo));
  };

  const colors = {
    background: darkMode ? '#121212' : '#f0f0f0',
    card: darkMode ? '#1e1e1e' : '#ffffff',
    text: darkMode ? '#ffffff' : '#000000',
    subtext: darkMode ? '#aaaaaa' : '#666666',
    border: darkMode ? '#333333' : '#dddddd',
    primary: '#1e90ff',
    danger: '#ff4d4f',
    overlay: '#00000088',
    input: darkMode ? '#2a2a2a' : '#f4f4f4',
  };

  return (
    <TemaContext.Provider value={{ darkMode, toggleDarkMode, colors }}>
      {children}
    </TemaContext.Provider>
  );
}

export const useTema = () => useContext(TemaContext);