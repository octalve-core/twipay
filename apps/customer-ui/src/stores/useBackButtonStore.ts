import { create } from "zustand";

type TBackButton = {
    buttonUrl: null | string;
    setButtonUrl: (path: null | string) => void;
    onClick: (() => void) | null;
    setOnClick: (handler: (() => void) | null) => void
}

const useBackButtonStore = create<TBackButton>((set) => ({
    buttonUrl: null,
    setButtonUrl: (path: null | string) => set(() => ({ buttonUrl: path})),
    onClick:  null,
    setOnClick: (handler: (() => void) | null) => set(() => ({ onClick: handler}))
}))

export default useBackButtonStore;