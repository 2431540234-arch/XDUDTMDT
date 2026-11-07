# Tệp bên thứ ba phục vụ tại chỗ

- `meshopt_decoder.js`: bộ giải nén Meshopt của [meshoptimizer](https://github.com/zeux/meshoptimizer) 0.18 (giấy phép MIT,
  Copyright (C) 2016-2022 Arseny Kapoulkine). Bản sao nguyên văn từ `node_modules/meshoptimizer/meshopt_decoder.js`.

Vì sao: các LOD do `model-processing` sinh ra được nén Meshopt, mà `<model-viewer>` mặc định tải bộ giải nén từ CDN
(jsdelivr) nên không xem được khi mất mạng hoặc chặn CDN. `ProductViewer3D` trỏ `meshoptDecoderLocation` về tệp này.
