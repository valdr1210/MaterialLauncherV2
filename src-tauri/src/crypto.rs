use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

pub fn encrypt_token(plain_text: &str) -> String {
    if plain_text.is_empty() || plain_text.starts_with("enc:") {
        return plain_text.to_string();
    }
    #[cfg(windows)]
    {
        if let Some(encrypted) = dpapi_encrypt(plain_text.as_bytes()) {
            return format!("enc:{}", BASE64.encode(encrypted));
        }
    }
    plain_text.to_string()
}

pub fn decrypt_token(encrypted_text: &str) -> String {
    if encrypted_text.is_empty() {
        return String::new();
    }
    if !encrypted_text.starts_with("enc:") {
        return encrypted_text.to_string();
    }
    #[cfg(windows)]
    {
        if let Ok(raw) = BASE64.decode(&encrypted_text[4..]) {
            if let Some(decrypted) = dpapi_decrypt(&raw) {
                if let Ok(s) = String::from_utf8(decrypted) {
                    return s;
                }
            }
        }
        return String::new();
    }
    #[cfg(not(windows))]
    {
        String::new()
    }
}

#[cfg(windows)]
fn dpapi_encrypt(data: &[u8]) -> Option<Vec<u8>> {
    use std::ptr;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB};

    unsafe {
        let mut in_blob = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut out_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };
        let ok = CryptProtectData(
            &mut in_blob,
            ptr::null(),
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
            0,
            &mut out_blob,
        );
        if ok == 0 || out_blob.pbData.is_null() {
            return None;
        }
        let slice = std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize);
        let result = slice.to_vec();
        LocalFree(out_blob.pbData as _);
        Some(result)
    }
}

#[cfg(windows)]
fn dpapi_decrypt(data: &[u8]) -> Option<Vec<u8>> {
    use std::ptr;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB};

    unsafe {
        let mut in_blob = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut out_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };
        let ok = CryptUnprotectData(
            &mut in_blob,
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
            0,
            &mut out_blob,
        );
        if ok == 0 || out_blob.pbData.is_null() {
            return None;
        }
        let slice = std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize);
        let result = slice.to_vec();
        LocalFree(out_blob.pbData as _);
        Some(result)
    }
}
