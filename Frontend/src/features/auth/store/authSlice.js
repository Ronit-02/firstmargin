import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    token: null,
    user: null,
    avatarUrl: null,
    email: null,
    role: null,
    isReady: false,
    isLoading: false,
    error: null
}

const authSlice = createSlice({
    name: 'auth',
    initialState: initialState,

    reducers: {
        loginStart(state){
            state.isLoading = true;
            state.error = null;
        },
        loginFailure(state, action){
            state.isLoading = false;
            state.error = action.payload;
        },
        loginSuccess(state, action){
            state.token = action.payload.token;
            state.user = action.payload.username;
            state.avatarUrl = action.payload.avatarUrl || null;
            state.email = action.payload.email;
            state.role = action.payload.role;
            state.isReady = true;
            state.isLoading = false;
        },
        authReady(state) {
            state.isReady = true;
        },
        logout(state){
            state.token = null;
            state.user = null;
            state.avatarUrl = null;
            state.email = null;
            state.role = null;
        },
        setAccessToken(state, action){
            state.token = action.payload.token;
        },
        setAvatarUrl(state, action) {
            state.avatarUrl = action.payload;
        },
        restoreCreds(state, action) {
            state.token = action.payload.token;
            state.user = action.payload.user;
            state.avatarUrl = action.payload.avatarUrl || null;
            state.email = action.payload.email;
            state.role = action.payload.role;
            state.isReady = true;
        }
    }
});

// action creators for each reducer function
export const { 
    loginStart, 
    loginSuccess, 
    loginFailure, 
    logout, 
    setAccessToken, 
    setAvatarUrl,
    restoreCreds,
    authReady
} = authSlice.actions;
export const authReducer = authSlice.reducer;
