import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EContentItem } from "@/entities/course/model/levelContentTypes";
import { ResourceContentViewer } from "@/entities/course/ui/resource-content-viewer/ResourceContentViewer";

describe("ResourceContentViewer & Media players", () => {
  it("renders image content viewer correctly", () => {
    const item = {
      id: "res-1",
      title: "Sample Image",
      url: "https://example.com/img.jpg",
      contentType: "image",
    };
    const { container } = render(<ResourceContentViewer item={item as unknown as EContentItem} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/img.jpg");
  });

  it("renders audio content viewer correctly", () => {
    const item = {
      id: "res-2",
      title: "Sample Audio",
      url: "https://example.com/audio.mp3",
      contentType: "audio",
    };
    const { container } = render(<ResourceContentViewer item={item as unknown as EContentItem} />);
    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute("src")).toBe("https://example.com/audio.mp3");
  });

  it("renders unsupported content viewer correctly and triggers open", () => {
    const item = {
      id: "res-3",
      title: "Sample Zip",
      url: "https://example.com/archive.zip",
      contentType: "zip",
    };
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ResourceContentViewer item={item as unknown as EContentItem} />);
    const btn = screen.getByText("Open Resource");
    expect(btn).toBeDefined();

    fireEvent.click(btn);
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/archive.zip",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("video player controls are interactive", () => {
    const item = {
      id: "res-4",
      title: "Sample Video",
      url: "https://example.com/video.mp4",
      contentType: "video",
    };

    const { container } = render(<ResourceContentViewer item={item as unknown as EContentItem} />);
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).not.toBeNull();

    // Stub HTML5 Video methods since jsdom does not implement them
    video.play = vi.fn().mockResolvedValue(undefined);
    video.pause = vi.fn();

    // Play button click
    const playBtn = screen.getAllByLabelText("Play video")[0] as HTMLElement;
    fireEvent.click(playBtn);
    expect(video.play).toHaveBeenCalled();

    // Controls play/pause toggle
    const ctrlPlayBtn = screen.getAllByLabelText("Play video")[1] ?? playBtn;
    fireEvent.click(ctrlPlayBtn);

    // Speed toggle
    const speedBtn = screen.getByLabelText("Change playback speed");
    fireEvent.click(speedBtn);
    expect(speedBtn.textContent).toBe("1.25x");

    // Skip back/forward
    const rewindBtn = screen.getByLabelText("Rewind 10 seconds");
    fireEvent.click(rewindBtn);
    const forwardBtn = screen.getByLabelText("Forward 10 seconds");
    fireEvent.click(forwardBtn);

    // Volume and Mute
    const muteBtn = screen.getByLabelText("Mute video");
    fireEvent.click(muteBtn);
    const volSlider = screen.getByLabelText("Video volume");
    fireEvent.change(volSlider, { target: { value: "0.5" } });

    // Fullscreen toggle
    const fullscreenBtn = screen.getByLabelText("Open video fullscreen");
    fireEvent.click(fullscreenBtn);

    // Mouse hover/leave
    const player = screen.getByRole("application");
    fireEvent.mouseLeave(player);
    fireEvent.mouseMove(player);

    // Seek click progress bar
    const seekBtn = screen.getByLabelText("Seek video");
    // Mock getBoundingClientRect
    seekBtn.getBoundingClientRect = () => ({
      width: 100,
      height: 10,
      left: 0,
      top: 0,
      bottom: 10,
      right: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    fireEvent.click(seekBtn, { clientX: 50 });
  });
});
