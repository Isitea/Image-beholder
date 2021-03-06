"use strict";
import { $client } from '/lib/browserUnifier.js';

async function pageModule() {
    let contents, contentRequest, infoRequest, pageJSON = JSON.parse( document.body.querySelector( '#__NEXT_DATA__' ).innerHTML );
    let User = {
        deviceId: pageJSON.props.initialState.common.constant.did,
        clientString: ( ( { name, osname } ) => `${osname} - ${name}` )( pageJSON.props.initialProps.userAgent )
    };
    
    let currentViewerKey = location.search.match( /[?&]?productId=(?<id>\d+)&?/ )?.groups.id;
    let singleForMeta = 
        pageJSON.props.initialState.viewer.viewers[currentViewerKey]?.singleForMeta ||
        pageJSON.props.initialState.product.productMap[currentViewerKey]?.singleForMeta;
    let { title, authorName, seriesTitle } = singleForMeta;
    
    let episode = title.replace( seriesTitle, "" ).toFilename();
    let raw = title.toFilename();
    title = `${seriesTitle} (${authorName})`.toFilename();
    
    infoRequest = ( function ( { props: { initialState } } ) {
        let form = new FormData();

        form.set( 'singlePid', currentViewerKey );
        form.set( 'seriesPid', singleForMeta.seriesId );
        form.set( 'deviceId', User.deviceId );

        return form;
    } )( pageJSON );

    contentRequest = ( function ( { props: { initialProps: { userAgent }, initialState } } ) {
        let form = new FormData();
        
        form.set( 'productId', currentViewerKey );
        form.set( 'device_mgr_uid', User.clientString );
        form.set( 'device_model', User.clientString );
        form.set( 'deviceId', User.deviceId );

        return form;
    } )( pageJSON );
    contents = await fetch(
        "https://api2-page.kakao.com/api/v1/inven/get_download_data/web",
        { method: 'POST', body: contentRequest, credentials: "include" }
    )
        .then( response => response.json() )
        .then( async ( { downloadData: { members } } ) => {
            if ( members.slide ) {
                let contents = [];
                let uri = ( await ( async function ( id ) {
                    while( !document.querySelector( id ) ) { await Promise( res => setTimeout( res, 250 ) ); }
                    return document.querySelector( id ).src;
                } )( `#epubScript_${currentViewerKey}` ) );
                let { body, head } = JSON.parse( ( await new Promise( response => $client.runtime.sendMessage( { message: Date.now(), action: "request", data: { uri } }, response ) ) ).match( /^onMainJsonLoaded\((?<json>.+)\);$/).groups.json );
                while ( body.match( /["'](?<src>http.+?)["']/ ) ) {
                    let { uri } = body.match( /["'](?<uri>http.+?)["']/ ).groups;
                    contents.push( { uri } );
                    body = body.replace( uri, `./${(contents.length - 1).toString().padStart( 3, "0" )}0.jpg` );
                }
                contents.push( { content: { name: `${title} - ${episode}.html`, text: `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>` } } );
                return contents;
            }
            else {
                return members.files.map( ( { secureUrl } ) => ( { uri: `${members.sAtsServerUrl}${secureUrl}` } ) )
            }
        } )
        .catch( e => new Promise( res => {} ) )

    return {
        moveNext: Promise.resolve( async () => location.assign(
            await fetch( "https://api2-page.kakao.com/api/v5/inven/get_next_item", { method: 'POST', body: infoRequest, credentials: "include" } )
            .then( response => response.json() )
            .then( ( { item } ) => ( item ? `?${item.pid.replace( /^p/, "productId=")}` : '#It_is_lasest_episode' ) )
        ) ),
        movePrev: Promise.resolve( async () => location.assign(
            await fetch( "https://api2-page.kakao.com/api/v5/inven/get_prev_item", { method: 'POST', body: infoRequest, credentials: "include" } )
            .then( response => response.json() )
            .then( ( { item } ) => ( item ? `?${item.pid.replace( /^p/, "productId=")}` : '#It_is_oldest_episode' ) )
        ) ),
        info: { raw, title, episode },
        contents,
    };
}

export { pageModule };