import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BarcodeScanner } from "@/components/BarcodeScanner";

afterEach(() => cleanup());

describe("Scanner — privacidade e entrada manual", () => {
  it("não solicita câmera ao abrir a tela", () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true, value: { getUserMedia },
    });
    render(<BarcodeScanner onDetected={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Abrir câmera/ })).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("permite usar código manual sem permitir leitura de GTIN inválido", () => {
    const detected = vi.fn();
    render(<BarcodeScanner onDetected={detected} />);
    const input = screen.getByLabelText("Digitar código");
    fireEvent.change(input, { target: { value: "7891234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Código inválido/);
    expect(detected).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "7891234567895" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar" }));
    expect(detected).toHaveBeenCalledWith("7891234567895");
  });
});
