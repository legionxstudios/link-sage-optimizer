export function isValidWebpageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Check if URL has a valid protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // Get file extension if any
    const pathname = parsedUrl.pathname;
    const extension = pathname.split('.').pop()?.toLowerCase();

    // List of common webpage extensions (add more if needed)
    const validExtensions = new Set(['', 'html', 'htm', 'php', 'asp', 'aspx', 'jsp']);
    
    // List of invalid extensions (files we don't want to process)
    const invalidExtensions = new Set([
      'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 
      'pdf', 'doc', 'docx', 'xls', 'xlsx',
      'zip', 'rar', 'tar', 'gz',
      'mp3', 'mp4', 'avi', 'mov',
      'css', 'js', 'json'
    ]);

    // Check if the extension is explicitly invalid
    if (extension && invalidExtensions.has(extension)) {
      console.log(`Filtered out file with extension: ${extension}`);
      return false;
    }

    // If there's an extension, it must be in the valid list
    if (extension && !validExtensions.has(extension)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating URL:', error);
    return false;
  }
}