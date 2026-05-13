import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// CI runners (especially Node 20) can be slow enough that the default 1 000 ms
// waitFor/findBy timeout causes false negatives.  5 s is still fast for unit
// tests while eliminating flakiness on underpowered hardware.
configure({ asyncUtilTimeout: 5000 });
