from __future__ import annotations

import uuid

from omni_media.contracts import GenerateRequest, GenerationParams
from omni_media.pipeline import OmniMediaPipeline


def main() -> None:
    pipeline = OmniMediaPipeline()

    request = GenerateRequest(
        id=str(uuid.uuid4()),
        modality="image",
        mode="default",
        prompt="A cinematic portrait of a futuristic city architect at dusk",
        params=GenerationParams(width=1024, height=1024, num_images=1, num_inference_steps=30),
        return_format="base64",
    )

    response = pipeline.run(request)
    print(response.status)
    print(response.metadata)


if __name__ == "__main__":
    main()
