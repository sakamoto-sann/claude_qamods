// Replacement callbacks preserve JavaScript dollar sequences literally.
export function renderPanel(template,css,script){
 const safeScript=script.replace(/<\/script/gi,match=>'<\\'+match.slice(1));
 return template.replace('__CSS__',()=>css).replace('__SCRIPT__',()=>safeScript);
}
