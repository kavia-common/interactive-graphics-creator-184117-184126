import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app header", () => {
  render(<App />);
  const header = screen.getByText(/Interactive Graphics Creator/i);
  expect(header).toBeInTheDocument();
});
