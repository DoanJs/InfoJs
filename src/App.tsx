import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from './screens/LoginPage';
import HomePage from './screens/HomePage';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from './firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import { UserModel } from './model/UserModel';
import { handleToastWarn } from './constants/handleToast';
import SpinnerComponent from './components/SpinnerComponent';
import useUserStore from './zustand/useUserStore';

type AuthState = {
  user: User | null;
  isLoading: boolean;
};

export default function App() {
  const { setUser } = useUserStore();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
  });
  
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setAuthState({ user: currentUser, isLoading: false });

      if (currentUser) {
        // chỉ fetch khi có user
        try {
          getDoc(doc(db, "users", currentUser.uid as string))
            .then(async (result) => {
              setUser({ ...result.data(), id: currentUser.uid } as UserModel);
            })
            .catch(async () => {
              await signOut(auth);
              handleToastWarn(
                "Tài khoản chưa được cấp quyền, vui lòng liên hệ admin !"
              );
            });
        } catch (error) {
          console.log("error: ", error);
        }
      } else {
        // clear user khi logout
        setUser(null);
      }
    });
    return () => unsub();
  }, [setUser]);

  if (authState.isLoading) {
    return <SpinnerComponent />;
  }
  
  return (
    <div>
      <Routes>
        <Route
          path="/login"
          element={
            authState.user ? <Navigate to="/" replace /> : <LoginPage />
          }
        />
        <Route
          path="/"
          element={
            authState.user ? (
              <HomePage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </div>
  )
}
